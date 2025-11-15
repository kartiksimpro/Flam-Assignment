

-----

# queue-cil: Background Job Queue System

`queue-cil` is a CLI-based background job queue system built in Node.js and MongoDB. It is designed to manage background tasks, handle concurrent execution, and provide robust failure handling with retries and a Dead Letter Queue.

-----

## 1\. 🚀 Setup Instructions

Follow these steps to run the project locally.

1.  **Clone Repository:**

    ```bash
    git clone <your-github-repo-url>
    cd queue-cil
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

    (This will install `mongoose` and `commander`.)

3.  **Run MongoDB:**
    Ensure you have a MongoDB server running locally. The project will connect to `mongodb://localhost:27017/queuectl` by default.

4.  **Make CLI Executable:**

    ```bash
    chmod +x queuefile.js
    ```

-----

## 2\. 💻 Usage Examples

All commands are run from the `./queuefile.js` executable.

### Managing Workers

Workers are the background processes that run jobs.

```bash
# Start a cluster of 4 worker processes
./queuefile.js worker start --count 4

# Stop all running workers gracefully
./queuefile.js worker stop
```

### Managing Jobs

Enqueueing, listing, and checking logs.

```bash
# Enqueue a simple "hello world" job
./queuefile.js enqueue '{"id":"job1", "command":"echo hello"}'

# List all jobs that are 'pending'
./queuefile.js list --state pending

# View the saved logs for a specific job
./queuefile.js log job1
```

### Bonus Feature Examples

```bash
# Enqueue a HIGH PRIORITY job (will run before others)
./queuefile.js enqueue '{"id":"vip-job", "command":"echo FIRST", "priority": 10}'

# Enqueue a job with a 5-second (5000ms) timeout
./queuefile.js enqueue '{"id":"timeout-job", "command":"sleep 10", "timeout": 5000}'
```

### System & DLQ

Checking status and managing failed jobs.

```bash
# Get a high-level summary of all job states & worker status
./queuefile.js status

# List all jobs in the Dead Letter Queue
./queuefile.js dlq list

# Manually retry a job from the DLQ
./queuefile.js dlq retry timeout-job
```

### Configuration

Manage global system settings.

```bash
# Set global max retries to 5
./queuefile.js config set max_retries 5

# Set a global 60-second job timeout (in ms)
./queuefile.js config set job_timeout 60000
```

-----

## 3\. 🏛️ Architecture Overview

The system is designed with a clear separation of concerns.

  * **Job Lifecycle:** Jobs move through a defined lifecycle:

    1.  **`pending`**: Waiting to be picked up.
    2.  **`processing`**: A worker has locked the job and is executing it.
    3.  **`completed`**: The job finished successfully.
    4.  **`failed`**: The job failed but is still retryable. It returns to `pending` with a future `run_at` time.
    5.  **`dead`**: The job has exhausted all retries and is in the Dead Letter Queue.

  * **Data Persistence:**
    The system uses **MongoDB** for all persistence. A `jobs` collection stores all job data, and a `configs` collection stores global settings. This choice was made to solve concurrency issues.

  * **Worker Logic (`helperfile.js`):**
    This is the "engine" of the system.

    1.  The `worker start` command uses the Node.js **`cluster`** module to spawn multiple `helperfile.js` processes.
    2.  Each worker runs an independent loop, polling the database for the next available job.
    3.  **Atomic Locking:** To prevent "duplicate job execution," the worker uses a single, atomic **`findOneAndUpdate`** operation. This query finds the highest-priority, available job and instantly updates its state to `processing`, "locking" it so no other worker can grab it.
    4.  The worker then executes the job's command using `child_process.exec`, handling timeouts, output logging, and all retry/DLQ logic.

-----

## 4\. 🤔 Assumptions & Trade-offs

  * **MongoDB vs. JSON/SQLite:** The spec allowed for simpler storage, but I chose **MongoDB**. This was a deliberate trade-off. A simple JSON file is prone to race conditions. MongoDB's `findOneAndUpdate` command is the industry-standard solution for an atomic "find and lock," which is the core requirement for a robust queue. This choice directly solves the "duplicate job execution" disqualification.
  * **PID File for Process Management:** The `worker start` command saves its Process ID (PID) to a `queuectl.pid` file. The `worker stop` command reads this file and sends a `SIGTERM` signal. This is a simple and effective IPC (Inter-Process Communication) method. The trade-off is that if the master process crashes, the `pid` file may become "stale" and require manual deletion.
  * **`child_process.exec`:** The worker uses `exec` to run commands. This is convenient as it runs in a shell. The trade-off is security; a production system would "sandbox" this execution or use `spawn` with more controls.

-----

## 5\. 🧪 Testing Instructions

You can verify all functionality by running these scenarios in your terminal. You will need two terminals open.

### Test 1: Success & Logging

1.  **Terminal 1 (Worker):** Start a worker.
    ```bash
    ./queuefile.js worker start --count 1
    ```
2.  **Terminal 2 (CLI):** Enqueue a job.
    ```bash
    ./queuefile.js enqueue '{"id":"test-success", "command":"echo Hello Tester"}'
    ```
3.  **Observe (Terminal 1):** The worker will log that it executed and completed `test-success`.
4.  **Terminal 2 (CLI):** Check the log.
    ```bash
    ./queuefile.js log test-success
    ```
    *(**Expected:** You should see "Hello Tester" in the STDOUT section.)*

### Test 2: Failure, Retry & DLQ

1.  **Terminal 2 (CLI):** Set a fast retry config (2 retries, 1s backoff).
    ```bash
    ./queuefile.js config set max_retries 2
    ./queuefile.js config set backoff_base 1
    ```
2.  **Terminal 1 (Worker):** Restart the worker (Ctrl+C, then `worker start`) to load the new config.
3.  **Terminal 2 (CLI):** Enqueue a job that will fail.
    ```bash
    ./queuefile.js enqueue '{"id":"test-fail", "command":"ls /nonexistent"}'
    ```
4.  **Observe (Terminal 1):** The worker will:
      * Run `test-fail` and log a failure.
      * Log "retrying (attempt 1/2)".
      * Wait 1 second, run it again, and fail again.
      * Log "Moving to DLQ".
5.  **Terminal 2 (CLI):** Verify the DLQ.
    ```bash
    ./queuefile.js dlq list
    ```
    *(**Expected:** You should see `test-fail` in the DLQ list.)*

### Test 3: Priority Queue

1.  **Terminal 1 (Worker):** Make sure a worker is running.
2.  **Terminal 2 (CLI):** Enqueue a slow job, then a normal job, then a high-priority job.
    ```bash
    ./queuefile.js enqueue '{"id":"slow-job", "command":"sleep 10"}'
    ./queuefile.js enqueue '{"id":"normal-job", "command":"echo normal"}'
    ./queuefile.js enqueue '{"id":"vip-job", "command":"echo vip", "priority": 10}'
    ```
3.  **Observe (Terminal 1):**
      * The worker will pick up `slow-job` and be busy for 10 seconds.
      * As soon as it's free, it will immediately run `vip-job` (because `priority: 10` is higher).
      * After `vip-job` finishes, it will run `normal-job`.

### Test 4: Job Timeout

1.  **Terminal 2 (CLI):** Set a short 2-second timeout.
    ```bash
    ./queuefile.js config set job_timeout 2000
    ```
2.  **Terminal 1 (Worker):** Restart the worker to load the new config.
3.  **Terminal 2 (CLI):** Enqueue a job that takes 5 seconds (longer than the timeout).
    ```bash
    ./queuefile.js enqueue '{"id":"test-timeout", "command":"sleep 5"}'
    ```
4.  **Observe (Terminal 1):**
      * The worker will execute `test-timeout`.
      * After 2 seconds, it will log "Job TIMED OUT".
      * It will then treat this timeout as a failure and begin the retry/DLQ process.
