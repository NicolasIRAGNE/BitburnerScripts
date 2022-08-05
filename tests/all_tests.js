import * as basic from "/tests/basic_tests.js";
import * as workload_manager_unit_tests from "/tests/workload_manager_unit_tests.js";
import * as t from "/lib/testing.js";

export async function main(ns)
{
    t.init(ns);
    await basic.run_tests(ns);
    await workload_manager_unit_tests.run_tests(ns);
    t.printReport();
}