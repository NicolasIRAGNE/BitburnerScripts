/**
 * Some sanity checks for the basic functionality of the testing framework.
 */

import * as lib from "/lib/lib.js";
import * as t from "/lib/testing.js";

function basic()
{
    t.expect_eq(50, 50); // pass
    t.expect_eq(50, 51); // fail
    let throws_if_odd = function(x) { if (x % 2 == 1) { throw new Error("Odd number"); } };
    t.expect_throw(throws_if_odd, 1); // pass
    t.expect_nothrow(throws_if_odd, 1); // fail
    // total: 4, pass: 2, fail: 2
}

function floats()
{
    t.expect_float_eq(1.0, 1.0); // pass
    t.expect_float_eq(1.0, 2.0); // fail
    t.expect_float_eq(1.0, 3.0); // fail
    t.expect_float_neq(1.0, 1.0); // fail
    t.expect_float_neq(1.0, 2.0); // pass
    t.expect_float_neq(1.0, 3.0); // pass
    t.expect_float_neq(1.0, 1.000001); // pass
    // total: 7, pass: 4, fail: 3
}

async function wait(ns, time)
{
    await ns.sleep(time);
}

function good()
{
    t.expect_true(true); // pass
}

export async function run_tests(ns)
{
    await lib.init(ns);
    t.init(ns);
    basic();
    floats();
    good();
    await t.prof(wait, null, ns, 10);
    await t.prof(wait, null, ns, 100);
    await t.prof(ns.tprint, ns, "Hello");
}

export async function main(ns)
{
    await run_tests(ns);
    t.printReport(ns);
}