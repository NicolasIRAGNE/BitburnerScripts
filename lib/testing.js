/**
 * @fileOverview Provides some basic testing functionality.
 */

let _ns = null;

export function init(ns)
{
    _ns = ns;
}

export class ExecutionContext
{
    constructor(depth = 0)
    {
        let context = new Error().stack;
        this.function = context.split("\n")[2 + depth].split(" ")[5];
        this.file = context.split("\n")[2 + depth].split("/")[3].split(":")[0];
        this.line = context.split("\n")[2 + depth].split("/")[3].split(":")[1];
    }
}

/**
 * 
 */
class TestSuite
{
    constructor()
    {
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;
        this.time = -1; // unimplemented at the moment
        this.tests = [];
    }

    /**
     * Returns a string representation of the test results in the form:
     * [STATE] name (PASSED/TOTAL) (x ms)
     * STATE is one of:
     * - PASS
     * - FAIL
     * - UNKN
     * @param {number} depth - The number of spaces to indent the output.
     */
    report(depth = 0)
    {
        let state = "UNKN";
        if (this.passed > 0)
        {
            state = "PASS";
        }
        if (this.failed > 0)
        {
            state = "FAIL";
        }
        let str = "";
        for (let i = 0; i < depth; i++)
        {
            str += " ";
        }
        let total = this.passed + this.failed;
        str += `[${state}] ${this.name} (${this.passed}/${total})`;
        for (let test of this.tests)
        {
            str += "\n" + test.report(depth + 2);
        }
        return str;
    }
}

let _testSuites = [];

function addTestResult(executionContext, result)
{
    let s = _testSuites.find(s => s.name === executionContext.file);
    if (!s)
    {
        s = new TestSuite();
        s.name = executionContext.file;
        _testSuites.push(s);
    }
    let child = s.tests.find(t => t.name === executionContext.function);
    if (!child)
    {
        child = new TestSuite();
        child.name = executionContext.function;
        s.tests.push(child);
    }
    if (result === true)
    {
        child.passed++;
        s.passed++;
    }
    else
    {
        child.failed++;
        s.failed++;
    }
}

export function printReport()
{
    let str = "";
    for (let s of _testSuites)
    {
        str += s.report() + "\n";
    }
    _ns.tprint("\n" + str);
}

/**
 * Expects equality between two values.
 * @param {*} a 
 * @param {*} b 
 */
export function expect_eq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a != b)
    {
        _ns.tprint(`\n\t${executionContext.function}:\n\t\tExpected equality of these two values:\n\t\t\t${a}\n\t\t\t${b}`);
    }
    addTestResult(executionContext, a == b);
}