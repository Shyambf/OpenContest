# OpenContest runners

The first runner consumes `judge.submissions` from RabbitMQ. The backend publishes a compact JSON job with submission id, problem id, limits, language, source code and tests.

Current implementation:

- supports C++17, Python 3, Java 17 and Rust submissions;
- compiles C++ with `g++`, Java with `javac`, Rust with `rustc`;
- runs every test through `nsjail`;
- compares normalized stdout with the expected answer;
- sends `AC`, `WA`, `TLE`, `RE` or `CE` back to `POST /api/submissions/{id}/result/`.

The runtime image includes both `g++` and `nsjail`. The Dockerfile builds `nsjail` from the official Google source repository in a separate stage, copies the binary into the final runner image and sets `NSJAIL_BIN=/usr/local/bin/nsjail`.

For local Docker Compose runs the runner is started with `privileged: true` and `seccomp=unconfined`, because nested namespace/cgroup operations are commonly blocked by Docker's default profile. In production Kubernetes this should become an explicit runner `securityContext` instead of an accidental default.

Next steps for production judging:

1. Pin `NSJAIL_REF` to a reviewed release or commit before production.
2. Add per-language resource tuning and version reporting.
3. Store large tests outside RabbitMQ payloads once problem archives become large.
4. Deploy the runner as a Kubernetes `Deployment` or KEDA-scaled workload driven by RabbitMQ queue length.
