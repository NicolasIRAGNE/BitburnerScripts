export async function main(ns)
{
    let size = 2**2;
    while (size < 2**20)
    {
        let price = await ns.getPurchasedServerCost(size);
        await ns.tprint(`${size}MB: ${price}`);
        size *= 2;
    }
}