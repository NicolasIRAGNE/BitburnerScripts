import * as lib from "./lib/lib.js";

export async function main(ns)
{
    let hosts = [];
    let ignored_files = ["simple.js", "scrapper.js", "grow.js"];
    await lib.recurse_scan_legacy(ns, "home", hosts);
    await ns.tprint("Found " + hosts.length + " hosts: " + hosts.join(", "));
    for (let host of hosts)
    {
        await lib.scrap_host(ns, host, await ns.getHostname(), ignored_files);
    }
}