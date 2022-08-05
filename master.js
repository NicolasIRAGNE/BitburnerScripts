import * as lib from "./lib/lib.js";

export async function main(ns)
{
    lib.init(ns);
    const growName = "grow.js";
    const hackName = "hack.js";
    let hosts = [];
    await lib.recurse_scan(ns, "home", hosts, [lib.try_nuke]);
    hosts = hosts.filter(host => ns.hasRootAccess(host.name));
    ns.tprint("Found " + hosts.length + " hosts with root access:");
    for (let host of hosts)
    {
        ns.tprint("\t" + host.repr());
    }
    let targets = hosts.filter(function(host) { return host.type !== lib.HostType.OWN; });
    targets = targets.filter(target => target.canHack);
    targets = targets.filter(target => target.maxMoney > 0);
    if (ns.args[0] != null)
    {
        targets = [ns.args[0]];
    }
    const ramCost = await ns.getScriptRam(growName) * 6 + await ns.getScriptRam(hackName) * 1;
    // Scan hosts recursively for all targets
    let installs = 0;
    let hostsCount = 0;
    const hackLevel = await ns.getHackingLevel();
    for (let h of hosts)
    {
        let hostname = h.name;
        if (!await ns.hasRootAccess(hostname))
        {
            ns.tprint(`No root access on ${hostname}, skipping...`);
            continue;
        }
        ns.tprint(`Installing ${growName} on ${hostname}...`);
        // await ns.scriptKill(growName, hostname);
        // await ns.scriptKill(hackName, hostname);
        // await ns.scriptKill("simple.js", hostname);
        let i = 0;
        let usedRam = await ns.getServerUsedRam(hostname);
        const maxRam = await ns.getServerMaxRam(hostname);
        await ns.scp(growName, hostname);
        await ns.scp(hackName, hostname);
        let threads = (maxRam - usedRam) / ramCost;
        threads /= targets.length;
        threads = Math.floor(threads);
        if (threads < 1)
        {
            threads = 1;
        }
        while (usedRam + (ramCost * threads) < maxRam)
        {
            const target = targets[i % targets.length];
            await ns.tprint(`\tRunning ${growName} ${target} with ${threads} threads... [${usedRam + ramCost * threads}/${maxRam}]`);
            let res = await ns.exec(growName, hostname, 6 * threads, target, i);
            if (res === 0)
            {
                await ns.tprint(`\tThere was an error running ${growName} on ${target}`);
            }
            res = await ns.exec(hackName, hostname, threads, target, installs);
            if (res === 0)
            {
                await ns.tprint(`\tThere was an error running ${hackName} on ${target}`);
            }
            installs += 9 * threads + 1;
            i++;
            usedRam = await ns.getServerUsedRam(hostname);
        }
        let extraInstalls = (maxRam - usedRam) / await ns.getScriptRam("grow.js");
        extraInstalls = Math.floor(extraInstalls);
        if (extraInstalls < 1)
        {
            continue;
        }
        const target = targets[Math.floor(Math.random() * targets.length)];
        let res = await ns.exec(growName, hostname, extraInstalls, target, installs);
        installs += extraInstalls;
        if (res === 0)
        {
            await ns.tprint(`\tThere was an error running ${growName} on ${target}`);
            break;
        }
        if (extraInstalls > 0)
        {
            await ns.tprint(`\tSqueezing some extra RAM out of ${hostname}... x${extraInstalls}`);
        }
        hostsCount++;
        await ns.sleep(2);
    }
    await ns.tprint(`Installed ${installs} instances of ${growName} on ${hostsCount} hosts`);
}
