/**
 * @fileOverview Provides some basic testing functionality.
 */

let _ns = null;

const sigma = 0.0000001;

export function init(ns)
{
    _ns = ns;
    _testSuites = [];
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

class TestSuite
{
    constructor()
    {
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0; // unimplemented at the moment
        this.time = -1; // unimplemented at the moment
        this.tests = [];
    }

    /**
     * Returns a string representation of the test results in the form:
     * [STATE] name (PASSED/TOTAL)
     * STATE is one of:
     * - PASS
     * - FAIL
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

function fmt(executionContext, str)
{
    // `\n\t${executionContext.function}:\n\t\tExpected inequality of these two values:\n\t\t\t${a}\n\t\t\t${b}`
    return `\n\t${executionContext.file}:${executionContext.line} ${executionContext.function}:\n\t\t${str}`;
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
        _ns.tprint(fmt(executionContext, `Expected equality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a == b);
}

export function expect_neq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a == b)
    {
        _ns.tprint(fmt(executionContext, `Expected inequality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a != b);
}

export function expect_gt(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a <= b)
    {
        _ns.tprint(fmt(executionContext, `Expected a > b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a > b);
}

export function expect_gte(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a < b)
    {
        _ns.tprint(fmt(executionContext, `Expected a >= b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a >= b);
}

export function expect_lt(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a >= b)
    {
        _ns.tprint(fmt(executionContext, `Expected a < b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a < b);
}

export function expect_lte(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a > b)
    {
        _ns.tprint(fmt(executionContext, `Expected a <= b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a <= b);
}

export function expect_true(a)
{
    let executionContext = new ExecutionContext(1);
    if (a !== true)
    {
        _ns.tprint(fmt(executionContext, `Expected true:\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a === true);
}

export function expect_false(a)
{
    let executionContext = new ExecutionContext(1);
    if (a !== false)
    {
        _ns.tprint(fmt(executionContext, `Expected false:\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a === false);
}

export function expect_null(a)
{
    let executionContext = new ExecutionContext(1);
    if (a !== null)
    {
        _ns.tprint(fmt(executionContext, `Expected null:\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a === null);
}

export function expect_throw(f, ...args)
{
    let executionContext = new ExecutionContext(1);
    try
    {
        f(...args);
    }
    catch (e)
    {
        addTestResult(executionContext, true);
        return;
    }
    _ns.tprint(fmt(executionContext, `Expected throw:\n\t\t\t${f.name}(${args.join(", ")})`));
    addTestResult(executionContext, false);
}

export function expect_nothrow(f, ...args)
{
    let executionContext = new ExecutionContext(1);
    try
    {
        f(...args);
    }
    catch (e)
    {
        _ns.tprint(fmt(executionContext, `Expected no throw:\n\t\t\t${f.name}(${args.join(", ")})`));
        addTestResult(executionContext, false);
        return;
    }
    addTestResult(executionContext, true);
}

export function expect_type(a, type)
{
    let executionContext = new ExecutionContext(1);
    if (typeof a !== type)
    {
        _ns.tprint(fmt(executionContext, `Expected type:\n\t\t\t${type}\n\t\t\t${a}`));
    }
    addTestResult(executionContext, typeof a === type);
}

export function expect_instanceof(a, type)
{
    let executionContext = new ExecutionContext(1);
    if (!(a instanceof type))
    {
        _ns.tprint(fmt(executionContext, `Expected instanceof:\n\t\t\t${type}\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a instanceof type);
}

export function expect_float_eq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (Math.abs(a - b) > sigma)
    {
        _ns.tprint(fmt(executionContext, `Expected equality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, Math.abs(a - b) < sigma);
}

export function expect_float_neq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (Math.abs(a - b) < sigma)
    {
        _ns.tprint(fmt(executionContext, `Expected inequality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, Math.abs(a - b) > sigma);
}