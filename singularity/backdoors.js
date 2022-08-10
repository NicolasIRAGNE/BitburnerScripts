const backdoorTargets = ["CSEC", "avmnite-02h", "I.I.I.I"];

async function get_map_to(ns, from, to, visited)
{
    visited = visited || [];
    if (visited.includes(from))
    {
        return [];
    }
    visited.push(from);
    if (from === to)
    {
        return [from];
    }
    const links = ns.scan(from);
    for (const link of links)
    {
        const path = await get_map_to(ns, link, to, visited);
        if (path.length > 0)
        {
            path.unshift(from);
            return path;
        }
    }
    return [];
}

async function handleBackdoors(ns)
{
    if (ns.getHostname() !== "home")
        return;
    for (const target of backdoorTargets)
    {
        const s = await ns.getServer(target);
        const hacking = ns.getHackingLevel();
        let route = await get_map_to(ns, ns.getHostname(), target);
        if (hacking >= s.requiredHackingSkill && !s.backdoorInstalled && ns.hasRootAccess(target))
        {
            ns.toast(`Attempting to install backdoor on ${s.hostname}`, "info", 6000);
            for (const server of route)
            {
                ns.toast(`Connecting to ${server}`, "info", 1000);
                const connected = await ns.singularity.connect(server);
                if (!connected)
                {
                    ns.toast(`Failed to connect to ${server}`, "error", 6000);
                    return;
                }
            }
            const res = await ns.singularity.installBackdoor();
            ns.toast(`Installed backdoor on ${s.hostname}`, "success", 6000);
            await ns.singularity.connect("home");
        }
    }
}

export async function main(ns)
{
    await handleBackdoors(ns);
}