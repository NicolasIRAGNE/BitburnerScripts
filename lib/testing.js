/**
 * @fileOverview Provides some basic testing functionality.
 */

let _ns = null;

const FLOATING_POINT_EPSILON = 0.0000001;

export function init(ns)
{
    _ns = ns;
    _testSuites = [];
    _profResults = [];
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
let _profResults = [];

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

/**
 * Print a report of the current module test results.
 */
export function printReport(ns)
{
    let str = "";
    if (_testSuites.length > 0)
        str += "Test Report:\n";
    for (let s of _testSuites)
        str += s.report() + "\n";
    if (_testSuites.length > 0)
        str += "\n";
    if (_profResults.length > 0)
        str += "Profiling Results:\n";
    for (let r of _profResults)
        str += `${r.func}: ${r.time}ms (${r.calls} calls)\n`;
    ns.tprint("\n" + str + "\n");
}

function fmt(executionContext, str)
{
    return `\n\t${executionContext.file}:${executionContext.line} ${executionContext.function}:\n\t\t${str}`;
}

/**
 * Expects equality between two expressions.
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

/**
 * Expects inequality between two expressions.
 * @param {*} a
 * @param {*} b
 */
export function expect_neq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a == b)
    {
        _ns.tprint(fmt(executionContext, `Expected inequality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a != b);
}
/**
 * Expects a value to be greater than another value.
 * @param {*} a
 * @param {*} b
 */
export function expect_gt(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a <= b)
    {
        _ns.tprint(fmt(executionContext, `Expected a > b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a > b);
}

/**
 * Expects a value to be greater than or equal to another value.
 * @param {*} a
 * @param {*} b
 */
export function expect_gte(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a < b)
    {
        _ns.tprint(fmt(executionContext, `Expected a >= b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a >= b);
}

/**
 * Expects a value to be less than another value.
 * @param {*} a
 * @param {*} b
 */
export function expect_lt(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a >= b)
    {
        _ns.tprint(fmt(executionContext, `Expected a < b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a < b);
}

/**
 * Expects a value to be less than or equal to another value.
 * @param {*} a
 * @param {*} b
 */
export function expect_lte(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (a > b)
    {
        _ns.tprint(fmt(executionContext, `Expected a <= b:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, a <= b);
}

/**
 * Expects an expression to be true.
 * @param {*} a
 */
export function expect_true(a)
{
    let executionContext = new ExecutionContext(1);
    if (a !== true)
    {
        _ns.tprint(fmt(executionContext, `Expected true:\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a === true);
}

/**
 * Expects an expression to be false.
 * @param {*} a
 */
export function expect_false(a)
{
    let executionContext = new ExecutionContext(1);
    if (a !== false)
    {
        _ns.tprint(fmt(executionContext, `Expected false:\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a === false);
}

/**
 * Expects an expression to be null.
 * @param {*} a
 */
export function expect_null(a)
{
    let executionContext = new ExecutionContext(1);
    if (a !== null)
    {
        _ns.tprint(fmt(executionContext, `Expected null:\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a === null);
}

/**
 * Expects a function to throw an exception.
 * @param {*} f The function to test.
 * @param {*} ...args Arguments to pass to the function.
 */
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

/**
 * Expects a function to not throw an exception.
 * @param {*} f The function to test.
 * @param {*} ...args Arguments to pass to the function.
 */
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

/**
 * Expect a value to be an instance of a class.
 * @param {*} a The value to test.
 * @param {*} type The class to test against.
 */
export function expect_instanceof(a, type)
{
    let executionContext = new ExecutionContext(1);
    if (!(a instanceof type))
    {
        _ns.tprint(fmt(executionContext, `Expected instanceof:\n\t\t\t${type}\n\t\t\t${a}`));
    }
    addTestResult(executionContext, a instanceof type);
}

/**
 * Expect a floating point value to be equal to another floating point value.
 * @param {*} a
 * @param {*} b
 * @note All floating point values are assumed to be equal if they are within 0.000001 of each other. This can be changed by changing the value of the constant `FLOATING_POINT_EPSILON`.
 */
export function expect_float_eq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (Math.abs(a - b) > FLOATING_POINT_EPSILON)
    {
        _ns.tprint(fmt(executionContext, `Expected equality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, Math.abs(a - b) < FLOATING_POINT_EPSILON);
}
/**
 * Expect a floating point value to be not equal to another floating point value.
 * @param {*} a
 * @param {*} b
 * @note All floating point values are assumed to be equal if they are within 0.000001 of each other. This can be changed by changing the value of the constant `FLOATING_POINT_EPSILON`.
 */
export function expect_float_neq(a, b)
{
    let executionContext = new ExecutionContext(1);
    if (Math.abs(a - b) < FLOATING_POINT_EPSILON)
    {
        _ns.tprint(fmt(executionContext, `Expected inequality of these two values:\n\t\t\t${a}\n\t\t\t${b}`));
    }
    addTestResult(executionContext, Math.abs(a - b) > FLOATING_POINT_EPSILON);
}

/**
 * Profile a function's execution time and number of calls.
 * @param {function} func The function to profile.
 * @param {...*} args The arguments to forward to the function.
 */
export async function prof(func, ...args)
{
    let timer_start = Date.now();
    let r = _profResults.find(x => x.func === func.name);
    if (!r)
    {
        r = { func: func.name, calls: 0, time: 0 };
        _profResults.push(r);
    }
    let res = await func.call(...args); // wtf am I doing
    let timer_end = Date.now();
    r.calls++;
    r.time += timer_end - timer_start;
    return res;
}