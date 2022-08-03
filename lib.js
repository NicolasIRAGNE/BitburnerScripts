
class Host
{
    constructor(ns, hostname)
    {
        this.name = hostname;
        this.cores = hostname === "home" ? 6 : 1; // update this when upgrading cores
        this.maxRam = hostname === "home" ? Math.floor(ns.getServerMaxRam(hostname) * 0.9) : ns.getServerMaxRam(hostname);
        this.usedRam = ns.getServerUsedRam(hostname);
        this.maxMoney = ns.getServerMaxMoney(hostname);
        this.minSec = ns.getServerMinSecurityLevel(hostname);
        this.reachableHosts = ns.scan(hostname);
        this.ns = ns;
        this.executions = 0;
        this.hackPercent = 0;
        this.beingHacked = false;
        this.busyUntil = 0;
        this.ready = false;
        this.isHome = hostname === "home";
        this.update();
    }

    update()
    {
        let timer_start = Date.now();
        this.usedRam = this.ns.getServerUsedRam(this.name);
        this.currentAvailableRam = this.maxRam - this.usedRam;
        this.currentMoney = this.ns.getServerMoneyAvailable(this.name);
        this.currentSec = this.ns.getServerSecurityLevel(this.name);
        this.canHack = this.ns.getHackingLevel() >= this.ns.getServerRequiredHackingLevel(this.name);
        this.hackChance = this.ns.formulas.hacking.hackChance(this.name, this.ns.getPlayer());
        this.growTime = this.ns.formulas.hacking.growTime(this.name, this.ns.getPlayer());
        this.growPercent = this.ns.formulas.hacking.growPercent(this.ns.getServer(this.name), 1, this.ns.getPlayer(), 1);
        this.weakenTime = this.ns.formulas.hacking.weakenTime(this.ns.getServer(this.name), this.ns.getPlayer());
        this.hackTime = this.ns.formulas.hacking.hackTime(this.name, this.ns.getPlayer());
        this.hackPercent = this.ns.formulas.hacking.hackPercent(this.ns.getServer(this.name), this.ns.getPlayer());
        this.hasRootAccess = this.ns.hasRootAccess(this.name);
        let timer_end = Date.now();
    }

    async exec(cmd, threads, args)
    {
        this.executions++;
        args.push(this.executions);
        await this.ns.scp(cmd, this.name);
        await this.ns.exec(cmd, this.name, threads, ...args, this.executions);
        this.update();
    }

    async run(task, factor = 1)
    {
        if (factor < 1)
        {
            return;
        }
        if (task.tasks != null)
        {
            for (let t of task.tasks)
            {
                await this.run(t, factor);
            }
        }
        else
        {
            let timer_exec_start = Date.now();
            await this.exec(task.script, factor, task.args);
            let timer_exec_end = Date.now();
            let timer_exec_duration = timer_exec_end - timer_exec_start;
            await this.ns.write("log.txt", `===>${this.name} executed ${task.script} with args ${task.args} in ${timer_exec_duration}ms\n`, "a'");
        }
    }

    async fill(task)
    {
        let concurrent = this.currentAvailableRam / task.cost;
        concurrent = Math.floor(concurrent);
        await this.run(task, concurrent);
        return concurrent * this.cores;
    }

    async satisfaction(task)
    {
        let concurrent = this.currentAvailableRam / task.cost;
        concurrent = Math.floor(concurrent);
        return concurrent * this.cores;
    }

    killall()
    {
        this.ns.killall(this.name);
        this.update();
    }

}

class Script
{
    constructor(ns, scriptName)
    {
        this.name = scriptName;
        this.cost = ns.getScriptRam(scriptName);
    }
}

/**
 * Recursively scan hostnames
 * @param {*} ns NetScript instance. Mandatory.
 * @param {*} hostname The hostname to use as starting point
 * @param {*} hosts Array of Host objects
 * @param {*} func The function to call for each hostname
 * @param {*} depth The depth of the scan. This should be set to 0 when calling this function.
 */
export async function recurse_scan(ns, hostname, hosts, funcs = [], depth = 0)
{
    // await ns.tprint(`${Array(depth).fill("-").join("")}Scanning ${hostname}...`);
    let host = hosts.find(h => h.name === hostname);
    if (!host)
    {
        if (funcs.length > 0)
        {
            for (let func of funcs)
            {
                await func(ns, hostname);
            }
        }
        host = new Host(ns, hostname);
        hosts.push(host);
    }
    else
    {
        return;
    }
    let children = await ns.scan(hostname);

    for (let child of children)
    {
        if (!hosts.find(h => h.name === child))
        {
            await recurse_scan(ns, child, hosts, funcs, depth + 1);
        }
    }
}

export async function recurse_scan_legacy(ns, hostname, hosts, funcs = [], depth = 0)
{
    // await ns.tprint(`${Array(depth).fill("-").join("")}Scanning ${hostname}...`);
    if (hosts.indexOf(hostname) === -1)
    {
        if (funcs.length > 0)
        {
            for (let func of funcs)
            {
                await func(ns, hostname);
            }
        }
        hosts.push(hostname);
    }
    else
    {
        return;
    }
    let children = await ns.scan(hostname);

    for (let child of children)
    {
        if (hosts.indexOf(child) === -1)
        {
            await recurse_scan_legacy(ns, child, hosts, funcs, depth + 1);
        }
    }
}

export async function try_nuke(ns, hostname)
{
    if (ns.hasRootAccess(hostname))
    {
        return true;
    }
    let res = false;
    ns.tprint("Trying to get root access on " + hostname + "...");
    try
    {
        ns.tprint("\tRunning brutessh...");
        ns.brutessh(hostname);
    }
    catch (e)
    {
        ns.tprint("\tbrutessh failed");
    }

    try
    {
        ns.tprint("\tRunning ftpcrack...");
        ns.ftpcrack(hostname);
    }
    catch (e)
    {
        ns.tprint("\tftpcrack failed");
    }

    try
    {
        ns.tprint("\tRunning relaysmtp...");
        ns.relaysmtp(hostname);
    }
    catch (e)
    {
        ns.tprint("\trelaysmtp failed");
    }

    try
    {
        ns.tprint("\tRunning httpworm...");
        ns.httpworm(hostname);
    }
    catch (e)
    {
        ns.tprint("\thttpworm failed");
    }

    try
    {
        ns.tprint("\tRunning sqlinject...");
        ns.sqlinject(hostname);
    }
    catch (e)
    {
        ns.tprint("\tsqlinject failed");
    }

    try
    {
        ns.tprint("\tRunning nuke...");
        ns.nuke(hostname);
        res = true;
    }
    catch (e)
    {
        ns.tprint("\tnuke failed");
        res = false;
    }
    return res;
}

export async function killall(ns, hostname)
{
    await ns.killall(hostname);
}

export async function scrap_host(ns, hostname, dst, ignored_files = [])
{
    let files = await ns.ls(hostname);
    files = files.filter(file => ignored_files.indexOf(file) === -1);
    await ns.tprint(`Scrapping ${hostname}...`);
    for (let file of files)
    {
        await ns.tprint(`\tScrapping ${file}...`);
        try
        {
            await ns.scp(file, hostname, dst);
        }
        catch (e)
        {
            ns.tprint("Failed to copy " + file + " to " + dst);
        }
    }
}

export function nextAction(ns, host)
{
    let hostname = host.name;
    const hackThreshold = 0.9;
    const maxMoney = ns.getServerMaxMoney(hostname);
    const minSec = ns.getServerMinSecurityLevel(hostname);
    let currentSec = host.currentSec;
    let moneyAvailable = host.currentMoney;
    const realMoneyAvailable = ns.getServerMoneyAvailable(hostname);
    if (currentSec > minSec)
    {
        return "weaken";
    }
    if (moneyAvailable < maxMoney * hackThreshold)
    {
        return "grow";
    }
    else if (!host.beingHacked)
        return "hack";
    return "none";
}

export const target_blacklist = ["darkweb", "avmnite-02h", "CSEC", "I.I.I.I", "home", "velka", "gwyn", "faraam", "filianore", "rob", "rob-0", "rob-1", "rob-2", "rob-3", "rob-4", "rob-5", "rob-6", "rob-7", "rob-8", "rob-9", "rob-10", "rob-11", "rob-12", "rob-13", "rob-14", "rob-15", "rob-16", "rob-17", "rob-18", "rob-19", "rob-20", "rob-21", "rob-22", "rob-23", "rob-24", "home"];

export const own_servers = ["rob-0", "rob-1", "rob-2"]

export function format_ram(ns, ram)
{
    return ns.nFormat(ram * 1000 * 1000 * 1000, '0.00b');
}

export async function print_status(ns, hostname)
{
    ns.tprint(`${hostname}: ${ns.nFormat(ns.getServerMoneyAvailable(hostname), '0.00a')} / ${ns.nFormat(ns.getServerMaxMoney(hostname), '0.00a')}$ , ${await ns.getServerSecurityLevel(hostname)} / ${await ns.getServerMinSecurityLevel(hostname)} sec`);
}