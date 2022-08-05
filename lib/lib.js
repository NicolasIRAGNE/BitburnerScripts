let _ns = null;

export let own_servers = null;

function check()
{
    if (_ns === null)
    {
        throw new Error("lib.init() must be called before lib.check()!");
    }
}

export function format_ram(ram)
{
    check();
    return _ns.nFormat(ram * 1000 * 1000 * 1000, '0.00b');
}

export function format_money(money)
{
    check();
    return _ns.nFormat(money, '0.00a');
}

export const HostType =
{
    OWN: 1 << 1,
    HOME: 1 << 2,
};

/**
 * A simple helper class to handle in-game hosts.
 * @class
 * @param {NS} ns The NetScript instance.
 * @param {string} host The name of the machine.
 */
export class Host
{
    constructor(ns, hostname)
    {
        if (_ns == null)
        {
            lib_init(ns);
        }
        // if this host is already present in own_servers, we don't need to do anything
        let h = own_servers.find(host => host.name == hostname);
        if (h != null)
        {
            Object.assign(this, h);
            return;
        }
        this.name = hostname;
        this.cores = hostname === "home" ? 6 : 1; // update this when upgrading cores
        this.maxRam = hostname === "home" ? Math.floor(ns.getServerMaxRam(hostname) * 0.9) : ns.getServerMaxRam(hostname); // dumb way to keep a bit of free ram on home
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
        this.server = ns.getServer(this.name);
        this.player = ns.getPlayer();
        this.type = 0;
        this.update();
    }

    update()
    {
        this.usedRam = this.ns.getServerUsedRam(this.name);
        this.currentAvailableRam = this.maxRam - this.usedRam;
        this.currentMoney = this.ns.getServerMoneyAvailable(this.name);
        this.currentSec = this.ns.getServerSecurityLevel(this.name);
        this.canHack = this.ns.getHackingLevel() >= this.ns.getServerRequiredHackingLevel(this.name);
        try
        {
            this.hackChance = this.ns.formulas.hacking.hackChance(this.name, this.player);
            this.growTime = this.ns.formulas.hacking.growTime(this.name, this.player);
            this.weakenTime = this.ns.formulas.hacking.weakenTime(this.server, this.player);
            this.hackTime = this.ns.formulas.hacking.hackTime(this.name, this.player);
            this.hackPercent = this.ns.formulas.hacking.hackPercent(this.server, this.player);
        }
        catch (e)
        {
            this.hackChance = 0;
            this.growTime = 0;
            this.weakenTime = 0;
            this.hackTime = 0;
            this.hackPercent = 0;
        }
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

    /**
     * Get a string representation of this host.
     * @returns {string}
     */
    repr()
    {
        let str = `${this.name}:`;
        let formatted_max_ram = format_ram(this.maxRam);
        let formatted_used_ram = format_ram(this.usedRam);
        let formatted_current_available_ram = format_ram(this.currentAvailableRam);
        let formatted_current_money = format_money(this.currentMoney);
        let formatted_max_money = format_money(this.maxMoney);
        let formatted_current_sec = this.currentSec.toFixed(2);
        let formatted_min_sec = this.minSec.toFixed(2);
        str += ` ${formatted_used_ram}/${formatted_max_ram} RAM, ${formatted_current_money} / ${formatted_max_money} money, ${formatted_current_sec} / ${formatted_min_sec} security level, type: ${this.type}`;
        return str;
    }

}

export function init(ns)
{
    _ns = ns;
    refresh_own_servers();
}

function refresh_own_servers()
{
    if (_ns === null)
    {
        throw new Error("lib.init() must be called before lib.refresh_own_servers()!");
    }
    let servers = _ns.getPurchasedServers();
    servers.push("home");
    for (let server of servers)
    {
        if (!own_servers)
        {
            own_servers = [];
        }
        if (!own_servers.find(host => host.name == server))
        {
            let host = new Host(_ns, server);
            host.type = HostType.OWN;
            if (server === "home")
            {
                host.type |= HostType.HOME;
            }
            own_servers.push(host);
        }
    }
}


/**
 * Recursively scan hostnames
 * @param {NS} ns NetScript instance. Mandatory.
 * @param {string} hostname The hostname to use as starting point
 * @param {Array<Host>} hosts Array of Host objects
 * @param {Array<Function(NS, string)>} funcs The function to call for each hostname (called as func(ns, hostname))
 * @param {Number} depth The depth of the scan. This should be set to 0 when calling this function.
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
 * @param {NS} ns NetScript instance. Mandatory.
 * @param {string} hostname The hostname to use as starting point
 * @param {Array<string>} hosts Array of *strings* of hostnames
 * @param {Array<Function(NS, string)>} funcs The function to call for each hostname (called as func(ns, hostname))
 * @param {Number} depth The depth of the scan. This should be set to 0 when calling this function.
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

export async function print_status(ns, hostname)
{
    ns.tprint(`${hostname}: ${ns.nFormat(ns.getServerMoneyAvailable(hostname), '0.00a')} / ${ns.nFormat(ns.getServerMaxMoney(hostname), '0.00a')}$ , ${await ns.getServerSecurityLevel(hostname)} / ${await ns.getServerMinSecurityLevel(hostname)} sec`);
}