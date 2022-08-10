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

export async function main(ns)
{
    let route = await get_map_to(ns, ns.getHostname(), ns.args[0]);
    let str = "";
    for (const server of route)
    {
        str += `connect ${server};`;
    }
    ns.tprint(str);
}