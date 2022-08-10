function getSpendableMoney(ns)
{
    let currentIncome = ns.getTotalScriptIncome()[0];
    const nb_nodes = ns.hacknet.numNodes();
    for(let i = 0; i < nb_nodes; i++)
    {
        currentIncome += ns.hacknet.getNodeStats(i).production;
    }
    return currentIncome;
}

function affordableRam(ns, amount)
{
    let i = 0;
    let n = 2;
    while (ns.getPurchasedServerCost(n) < amount && i <= 20)
    {
        n = 2 ** i;
        i++;
    }
    return n;
}

async function deleteServer(ns, threshold)
{
    const servers = ns.getPurchasedServers();
    for (const server of servers)
    {
        const ram = ns.getServerMaxRam(server);
        if (ram < threshold)
        {
            await ns.killall(server);
            ns.deleteServer(server);
            ns.toast(`Deleted server ${server} (${ram} RAM)`, "success");
            break;
        }
    }
}

async function handlePotentialPurchases(ns)
{
    const moneyThreshold = 10; // only buy if the purchase would represent less than 5% of our money
    const player = ns.getPlayer();
    const currentMoney = getSpendableMoney(ns);
    const moneyAvailable = (currentMoney * moneyThreshold) | 1;
    ns.tprint(`money available: ${moneyAvailable}`);
    // tor router
    if (moneyAvailable >= 200e3)
    {
        const alreadyHasTor = player.tor;
        const res = ns.singularity.purchaseTor();
        if (res && !alreadyHasTor)
            ns.toast(`Purchased TOR router!`, "success");
    }

    const programs = ns.singularity.getDarkwebPrograms();
    for (const program of programs)
    {
        const price = ns.singularity.getDarkwebProgramCost(program);
        if (price > moneyAvailable)
            continue;
        if (ns.fileExists(program, "home"))
            continue;
        const res = ns.singularity.purchaseProgram(program);
        if (res)
            ns.toast(`Purchased ${program} from DarkWeb`, "info", 6000);
    }
    let affordableRamAmount = affordableRam(ns, moneyAvailable);
    if (ns.getPurchasedServers().length >= ns.getPurchasedServerLimit())
    {
        await deleteServer(ns, affordableRamAmount);
    }
    if (affordableRamAmount > 2)
    {
        const res = ns.purchaseServer("rob", affordableRamAmount);
        if (res)
            ns.toast(`Purchased ${affordableRamAmount} RAM`, "success", 6000);
    }

}

export async function main(ns)
{
    await handlePotentialPurchases(ns);
}