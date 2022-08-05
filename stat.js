import * as lib from "./lib/lib.js";

export async function main(ns)
{
    await lib.recurse_scan_legacy(ns, "home", [], [lib.print_status]);
}