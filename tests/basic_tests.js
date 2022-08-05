/**
 * Some sanity checks for the basic functionality of the testing framework.
 */

import * as lib from "/lib/lib.js";
import * as t from "/lib/testing.js";

function throws_if_odd(x)
{
    if (x % 2 == 1)
    {
        throw new Error("Odd number");
    }
}

function basic()
{
    t.expect_eq(1, 1); // pass
    t.expect_eq(1, 2); // fail
    t.expect_eq(1, 3); // fail
    t.expect_neq(1, 1); // fail
    t.expect_neq(1, 2); // pass
    t.expect_neq(1, 3); // pass
    // total: 9, pass: 3, fail: 3
}

function floats()
{
    t.expect_float_eq(1.0, 1.0); // pass
    t.expect_float_eq(1.0, 2.0); // fail
    t.expect_float_eq(1.0, 3.0); // fail
    t.expect_float_neq(1.0, 1.0); // fail
    t.expect_float_neq(1.0, 2.0); // pass
    t.expect_float_neq(1.0, 3.0); // pass
    t.expect_float_neq(1.0, 1.00001); // pass
    // total: 7, pass: 4, fail: 3
}

function allgood()
{
    t.expect_true(true); // pass
}

function allbad()
{
    t.expect_true(false); // fail
}

export async function main(ns)
{
    lib.init(ns);
    t.init(ns);
    basic();
    floats();
    allgood();
    allbad();
    t.printReport();
}