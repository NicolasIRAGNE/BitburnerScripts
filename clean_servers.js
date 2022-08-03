// Delete all servers that are below specified RAM

export async function main(ns)
{
    let size = 2 ** ns.args[0];
    let servers = await ns.getPurchasedServers();
    for (let server of servers)
    {
        if (await ns.getServerMaxRam(server) < size)
        {
            await ns.tprint(`Deleting ${server}`);
            await ns.killall(server);
            await ns.deleteServer(server);
        }
    }
}