/**
 * Some sanity checks for the basic functionality of the testing framework.
 */

import * as lib from "/lib/lib.js";
import * as t from "/lib/testing.js";

function foo()
{
    let ctx = new t.ExecutionContext();
    t.expect_eq(ctx.function, "foo");
    t.expect_eq(ctx.file, "basic_tests.js");
}

function bar()
{
    t.expect_eq(1, 1);
    t.expect_eq(1, 2);
    t.expect_eq(1, 3);
}

export async function main(ns)
{
    lib.init(ns);
    t.init(ns);
    foo();
    bar();
    t.printReport();
}