export async function main(ns)
{
    let name = ns.getHostname();
    if (name === "home")
    {
        return;
    }
    await ns.killall();
}