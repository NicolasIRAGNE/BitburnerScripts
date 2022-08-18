function getSpendableMoney(ns)
{
    let currentIncome = ns.getTotalScriptIncome()[0] * 0.01;
    currentIncome = Math.min(currentIncome, 1e5);
    const nb_nodes = ns.hacknet.numNodes();
    for (let i = 0; i < nb_nodes; i++)
    {
        currentIncome += ns.hacknet.getNodeStats(i).production;
    }
    return currentIncome;
}

async function handleHacknet(ns)
{
    const moneyThreshold = 1; // only buy if the purchase would represent less than this
    let moneyAvailable = (getSpendableMoney(ns) * moneyThreshold) | 0;
    let levelUps = 0;
    let ramUps = 0;
    let purchases = 0;
    let coreUps = 0;
    // ns.tprint(`Money available: ${moneyAvailable}`);
    if (moneyAvailable >= ns.hacknet.getPurchaseNodeCost() && ns.hacknet.numNodes() < ns.hacknet.maxNumNodes())
    {
        const res = ns.hacknet.purchaseNode();
        if (res >= 0)
           purchases++;
        else
            ns.toast(`Failed to purchase Hacknet node`, "error", 3000);
    }
    const nb_nodes = ns.hacknet.numNodes();
    for (let i = 0; i < nb_nodes; i++)
    {
        moneyAvailable = (getSpendableMoney(ns) * moneyThreshold) | 0;
        if (moneyAvailable >= ns.hacknet.getRamUpgradeCost(i, 1))
        {
            let n = 1;
            while (moneyAvailable >= ns.hacknet.getLevelUpgradeCost(i, n))
            {
                n++;
            }
            n--;
            const res = ns.hacknet.upgradeRam(i, n);
            if (res)
                ramUps += n;
            else
                ns.toast(`Failed to upgrade Hacknet node ${i}'s RAM`, "error", 3000);
        }
        moneyAvailable = (getSpendableMoney(ns) * moneyThreshold) | 0;
        if (moneyAvailable >= ns.hacknet.getCoreUpgradeCost(i, 1))
        {
            const res = ns.hacknet.upgradeCore(i, 1);
            if (res)
                coreUps++;
            else
                ns.toast(`Failed to upgrade Hacknet node ${i}'s Core`, "error", 3000);
        }
        moneyAvailable = (getSpendableMoney(ns) * moneyThreshold) | 0;
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
            if (res)
                levelUps += n;
            // else
            // ns.toast(`Failed to upgrade Hacknet node ${i}'s Level`, "error", 6000);
            // return;
        }
        
    }
    if (levelUps > 0 || coreUps > 0 || ramUps > 0 || purchases > 0)
        ns.toast(`Hacknet: ${levelUps} level ups, ${coreUps} core ups, ${ramUps} ram ups, ${purchases} purchases`, "success", 3000);
}

export async function main(ns)
{
    await handleHacknet(ns);
}