Run the full StockLens test suite and report results.

Steps:
1. Run `cd /home/user/bhrum/stocklens && npm test 2>&1` to execute all 103 tests.
2. Parse the output and report:
   - Total tests: passed / failed / skipped
   - Which suites passed and which failed
   - Any specific failure messages with file + line number
   - Coverage summary if available
3. If any tests failed:
   - Identify the root cause (is it a logic bug, a type error, a broken assertion, or a cache issue?)
   - Propose a fix with the exact file and line to change
   - Do NOT automatically apply fixes — ask for confirmation first
4. If all tests pass, confirm: "All 103 tests green ✓"

Arguments (optional): $ARGUMENTS
- If the user passes a pattern (e.g. "backtest", "cache", "aapl"), run only matching tests:
  `npm test -- --testNamePattern="$ARGUMENTS"`
