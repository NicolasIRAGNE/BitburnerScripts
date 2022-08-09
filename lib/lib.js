/**
 * @fileOverview Provides some basic and general purpose utility functions.
 */

export let own_servers = [];

export async function format_ram(ns, ram)
{
    return ns.nFormat(ram * 1000 * 1000 * 1000, '0.00b');
}

export function format_money(ns, money)
{
    return ns.nFormat(money, '0.00a');
}

/**
 * The type of Host.
 * @enum {number}
 */
export const HostType =
{
    /** The host is a purchased server. */
    OWN: 1 << 1,
    /** The host is the home server. */
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

        this.name = hostname;
        this.ns = ns;
        this.executions = 0;
        this.type = 0;
    }

    async update()
    {
        Object.assign(this, this.ns.getServer(this.name));
        if (this.purchasedByPlayer)
        {
            this.type |= HostType.OWN;
        }
        if (this.name === "home")
        {
            this.type |= HostType.HOME;
        }
        this.maxRam = this.name === "home" ? this.maxRam * 0.8 : this.maxRam;
        this.currentAvailableRam = this.maxRam - this.ramUsed;
        this.currentMoney = this.moneyAvailable;
        this.canHack = this.requiredHackingSkill <= await this.ns.getHackingLevel();
    }

    /**
     * Execute a script on this host.
     * @param {string} cmd Path to the script to execute.
     * @param {*} threads Number of threads to use.
     * @param {*} args Arguments to pass to the script.
     * @note This will copy the script to the host before executing it.
     */
    async exec(cmd, threads, args)
    {
        this.executions++;
        await this.ns.scp(cmd, this.name);
        let res = await this.ns.exec(cmd, this.name, threads, ...args, this.executions);
        await this.update();
        return res;
    }

    /**
     * Kill all running scripts on this host.
     */
    async killall()
    {
        await this.ns.killall(this.name);
        await this.update();
    }

    /**
     * Get a string representation of this host.
     * @returns {string}
     */
    repr()
    {
        let str = `${this.name}:`;
        let formatted_max_ram = format_ram(this.ns, this.maxRam);
        let formatted_used_ram = format_ram(this.ns, this.ramUsed);
        let formatted_current_available_ram = format_ram(this.ns, this.currentAvailableRam);
        let formatted_current_money = format_money(this.ns, this.moneyAvailable);
        let formatted_max_money = format_money(this.ns, this.moneyMax);
        let formatted_current_sec = this.hackDifficulty	.toFixed(2);
        let formatted_min_sec = this.minDifficulty.toFixed(2);
        str += ` ${formatted_used_ram}/${formatted_max_ram} RAM, ${formatted_current_money} / ${formatted_max_money} money, ${formatted_current_sec} / ${formatted_min_sec} security level, type: ${this.type}`;
        return str;
    }
}

/**
 * The intended way to create a Host object.
 * @param {NS} ns The NetScript instance.
 * @param {string} hostname The name of the host.
 * @returns {Host} A new host object.
 */
export async function createHost(ns, hostname)
{
    let host = new Host(ns, hostname);
    await host.update();
    return host;
}

/**
 * Init the own_servers array. Not sure if this works. Best not to use it.
 * @param {NS} ns The NetScript instance.
 */
export async function init(ns)
{
    ns.tprint("Initializing lib.js...");
    await refresh_own_servers(ns);
}

async function refresh_own_servers(ns)
{
    own_servers = [];
    let servers = ns.getPurchasedServers();
    servers.push("home");
    for (let server of servers)
    {
        if (!own_servers || own_servers.length === 0)
        {
            own_servers = [];
        }
        if (!own_servers.find(host => host.name == server))
        {
            let host = await createHost(ns, server);
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
        host = await createHost(ns, hostname);
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

/**
 * Try to get access to a host by running all port opening programs and then nuke.
 * @param {NS} ns NetScript instance.
 * @param {string} hostname The server to access.
 * @returns {boolean} True if access was granted, false otherwise.
 */
export async function try_nuke(ns, hostname)
{
    if (ns.hasRootAccess(hostname))
    {
        return true;
    }
    let res = false;
    ns.print("Trying to get root access on " + hostname + "...");
    try
    {
        ns.print("\tRunning brutessh...");
        ns.brutessh(hostname);
    }
    catch (e)
    {
        ns.print("\tbrutessh failed");
    }

    try
    {
        ns.print("\tRunning ftpcrack...");
        ns.ftpcrack(hostname);
    }
    catch (e)
    {
        ns.print("\tftpcrack failed");
    }

    try
    {
        ns.print("\tRunning relaysmtp...");
        ns.relaysmtp(hostname);
    }
    catch (e)
    {
        ns.print("\trelaysmtp failed");
    }

    try
    {
        ns.print("\tRunning httpworm...");
        ns.httpworm(hostname);
    }
    catch (e)
    {
        ns.print("\thttpworm failed");
    }

    try
    {
        ns.print("\tRunning sqlinject...");
        ns.sqlinject(hostname);
    }
    catch (e)
    {
        ns.print("\tsqlinject failed");
    }

    try
    {
        ns.print("\tRunning nuke...");
        ns.nuke(hostname);
        res = true;
    }
    catch (e)
    {
        ns.print("\tnuke failed");
        res = false;
    }
    return res;
}

/**
 * Kill all processes on a host.
 */
export async function killall(ns, hostname)
{
    await ns.killall(hostname);
}

/**
 * Download all files from a host to another machine.
 * @param {NS} ns NetScript instance.
 * @param {string} hostname The hostname to download from.
 * @param {string} dst The hostname to download to.
 * @param {string[]} ignored_files Array of files to ignore.
 */
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

/**
 * Print some info about a host, such as money available, current security level, etc.
 */
export async function print_status(ns, hostname)
{
    ns.tprint(`${hostname}: ${ns.nFormat(ns.getServerMoneyAvailable(hostname), '0.00a')} / ${ns.nFormat(ns.getServerMaxMoney(hostname), '0.00a')}$ , ${await ns.getServerSecurityLevel(hostname)} / ${await ns.getServerMinSecurityLevel(hostname)} sec`);
}