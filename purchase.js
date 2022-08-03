export async function main(ns)
{
    let size = 2 ** ns.args[0];
    let price = await ns.getPurchasedServerCost(size);
    let currentMoney = await ns.getServerMoneyAvailable("home");
    let potentialPurchases = Math.floor(currentMoney / price);
    ns.print(`You can purchase ${potentialPurchases} servers of size ${size} for ${price} each`);
    if (potentialPurchases <= 0)
    {
        await ns.print("You don't have enough money to purchase any servers");
        return;
    }
    let res = (ns.args[1] != null) ? true : await ns.prompt(`Purchase ${potentialPurchases} servers of size ${size} for ${price} each?`);
    if (res)
    {
        for (let i = 0; i < potentialPurchases; i++)
        {
            let new_host = await ns.purchaseServer("rob", size);
            if (new_host.length > 0)
            {
                await ns.print(`Purchased ${new_host}`);
            }
            else
            {
                await ns.print(`Failed to purchase`);
                return;
            }
        }
    }
}