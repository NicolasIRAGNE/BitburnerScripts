export async function main(ns)
{
    while (true)
    {
        let symbols = ns.stock.getSymbols();
        for (let symbol of symbols)
        {
            let forecast = ns.stock.getForecast(symbol);
            if (forecast > 0.5)
            {
                ns.stock.buy(symbol, 300);
            }
            else
            {
                ns.stock.sell(symbol, 300);
            }
        }
        await ns.sleep(100);
    }
}