let _ns = null;

export let own_servers = null;

export function init(ns)
{
    _ns = ns;
    own_servers = ns.getPurchasedServers();
}

export class Host
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
        this.server = ns.getServer(this.name);
        this.player = ns.getPlayer();
        this.update();
    }

    update()
    {
        this.usedRam = this.ns.getServerUsedRam(this.name);
        this.currentAvailableRam = this.maxRam - this.usedRam;
        this.currentMoney = this.ns.getServerMoneyAvailable(this.name);
        this.currentSec = this.ns.getServerSecurityLevel(this.name);
        this.canHack = this.ns.getHackingLevel() >= this.ns.getServerRequiredHackingLevel(this.name);
        this.hackChance = this.ns.formulas.hacking.hackChance(this.name, this.player);
        this.growTime = this.ns.formulas.hacking.growTime(this.name, this.player);
        this.weakenTime = this.ns.formulas.hacking.weakenTime(this.server, this.player);
        this.hackTime = this.ns.formulas.hacking.hackTime(this.name, this.player);
        this.hackPercent = this.ns.formulas.hacking.hackPercent(this.server, this.player);
        this.hasRootAccess = this.ns.hasRootAccess(this.name);
    }

    async exec(cmd, threads, args)
    {
        this.executions++;
        args.push(this.executions);
        await this.ns.scp(cmd, this.name);
        await this.ns.exec(cmd, this.name, threads, ...args, this.executions);
        this.update();
    }

    killall()
    {
        this.ns.killall(this.name);
        this.update();
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

/**
 * Recursively scan hostnames. This is kept for legacy reasons.
 * @param {*} ns NetScript instance. Mandatory.
 * @param {*} hostname The hostname to use as starting point
 * @param {*} hosts Array of *strings* of hostnames
 * @param {*} func The function to call for each hostname
 * @param {*} depth The depth of the scan. This should be set to 0 when calling this function.
 */
export async function recurse_scan_legacy(ns, hostname, hosts, funcs = [], depth = 0)
{
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

export function format_ram(ns, ram)
{
    return ns.nFormat(ram * 1000 * 1000 * 1000, '0.00b');
}

export async function print_status(ns, hostname)
{
    ns.tprint(`${hostname}: ${ns.nFormat(ns.getServerMoneyAvailable(hostname), '0.00a')} / ${ns.nFormat(ns.getServerMaxMoney(hostname), '0.00a')}$ , ${await ns.getServerSecurityLevel(hostname)} / ${await ns.getServerMinSecurityLevel(hostname)} sec`);
}