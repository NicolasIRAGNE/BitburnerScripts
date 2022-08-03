export async function main(ns)
{
    while (true)
    {
        let symbols = ns.stock.getSymbols();
        for (let symbol of symbols)
        {
            // let forecast = ns.stock.getForecast(symbol);
            // if (forecast > 0.5)
            // {
            //     // ns.stock.buy(symbol, 1500);
            // }
            // else
            // {
                ns.stock.sell(symbol, 15000);
            // }
        }
        await ns.sleep(100);
    }
}