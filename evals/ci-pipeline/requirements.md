Draw our CI/CD pipeline.

A developer pushes a commit to a branch. The Git host sends a webhook to the build agent. The build agent fetches dependencies from a package cache and reads deploy keys from a secrets vault, which is optional.

The build agent compiles the code and hands it to the test suite. A quality gate checks the results. If tests fail, a retry step runs the flaky tests again and sends them back to the test suite. If all tests pass, the build passes.

Put the gate, the retry step and the passed build in a quality checks phase. After that, a person approves the release, and it goes out as a production deploy. Put those two steps in a human approval phase.
