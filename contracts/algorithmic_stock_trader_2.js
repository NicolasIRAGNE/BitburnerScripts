/**
 *  You are attempting to solve a Coding Contract. You have 10 tries remaining, after which the contract will self-destruct.

    You are given the following array of stock prices (which are numbers) where the i-th element represents the stock price on day i:

    136,100,103,155,112,41,75,120,35,187

    Determine the maximum possible profit you can earn using as many transactions as you'd like. A transaction is defined as buying and then selling one share of the stock. Note that you cannot engage in multiple transactions at once. In other words, you must sell the stock before you buy it again.

    If no profit can be made, then the answer should be 0
 */

export async function main(ns)
{
    const prices = [136, 100, 103, 155, 112, 41, 75, 120, 35, 187];
    const profit = getProfit(prices);
    ns.tprint(`The maximum profit is ${profit}`);
}

function getProfit(prices)
{
    let profit = 0;
    for (let i = 1; i < prices.length; i++)
    {
        if (prices[i] > prices[i - 1])
        {
            profit += prices[i] - prices[i - 1];
        }
    }
    return profit;
}