function getSpendableMoney(ns)
{
    let currentIncome = ns.getTotalScriptIncome()[0] * 0.01;
    const nb_nodes = ns.hacknet.numNodes();
    for(let i = 0; i < nb_nodes; i++)
    {
        currentIncome += ns.hacknet.getNodeStats(i).production;
    }
    return currentIncome;
}

async function handleHacknet(ns)
{
    const moneyThreshold = 1; // only buy if the purchase would represent less than this
    const currentMoney = getSpendableMoney(ns);
    const moneyAvailable = (currentMoney * moneyThreshold) | 0;
    // ns.tprint(`Money available: ${moneyAvailable}`);
    if (moneyAvailable >= ns.hacknet.getPurchaseNodeCost() && ns.hacknet.numNodes() < ns.hacknet.maxNumNodes())
    {
        const res = ns.hacknet.purchaseNode();
        if (res >= 0)
            ns.toast(`Purchased Hacknet node`, "info", 3000);
        else
            ns.toast(`Failed to purchase Hacknet node`, "error", 3000);
        return;
    }
    const nb_nodes = ns.hacknet.numNodes();
    for(let i = 0; i < nb_nodes; i++)
    {
        if (moneyAvailable >= ns.hacknet.getRamUpgradeCost(i, 1))
        {
            const res = ns.hacknet.upgradeRam(i, 1);
            if (res)
                ns.toast(`Upgraded Hacknet node ${i}'s RAM`, "info", 3000);
            else
                ns.toast(`Failed to upgrade Hacknet node ${i}'s RAM`, "error", 3000);
            return;
        }
        if (moneyAvailable >= ns.hacknet.getCoreUpgradeCost(i, 1))
        {
            const res = ns.hacknet.upgradeCore(i, 1);
            if (res)
                ns.toast(`Upgraded Hacknet node ${i}'s Core`, "info", 3000);
            else
                ns.toast(`Failed to upgrade Hacknet node ${i}'s Core`, "error", 3000);
            return;
        }
        let n = 1;
        while (moneyAvailable >= ns.hacknet.getLevelUpgradeCost(i, n))
        {
            n++;
        }
        n--;
        // ns.tprint(`cost for ${n} is ${ns.hacknet.getLevelUpgradeCost(i, n)}, +1 would be ${ns.hacknet.getLevelUpgradeCost(i, n + 1)}, and we have ${moneyAvailable}`);
        if (n > 0 && n !== Infinity)
        {
            const res = ns.hacknet.upgradeLevel(i, n);
            // if (res)
                // ns.toast(`Upgraded Hacknet node ${i}'s Level by ${n}`, "info", 6000);
            // else
                // ns.toast(`Failed to upgrade Hacknet node ${i}'s Level`, "error", 6000);
            return;
        }
    }
}

export async function main(ns)
{
    await handleHacknet(ns);
}