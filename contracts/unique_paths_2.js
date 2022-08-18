/**
 * You are located in the top-left corner of the following grid:

    0,0,1,0,0,1,0,1,1,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,1,0,0,0,0,0,0,
    1,0,1,0,0,0,0,0,0,0,
    0,0,1,0,0,0,0,1,0,0,
    0,0,0,0,0,0,0,1,0,1,
    0,0,0,1,0,0,0,0,0,0,
    1,0,0,1,0,1,0,0,0,0,
    1,0,0,0,1,0,0,0,0,0,

    You are trying reach the bottom-right corner of the grid, but you can only move down or right on each step. Furthermore, there are obstacles on the grid that you cannot move onto. These obstacles are denoted by '1', while empty spaces are denoted by 0.

    Determine how many unique paths there are from start to finish.
 */

export async function main(ns)
{
    const grid = [
        [0,0,1,0,0,1,0,1,1,0],
        [0,0,0,0,0,0,0,0,0,0],
        [0,0,0,1,0,0,0,0,0,0],
        [1,0,1,0,0,0,0,0,0,0],
        [0,0,1,0,0,0,0,1,0,0],
        [0,0,0,0,0,0,0,1,0,1],
        [0,0,0,1,0,0,0,0,0,0],
        [1,0,0,1,0,1,0,0,0,0],
        [1,0,0,0,1,0,0,0,0,0],
    ];
    const start = [0, 0];
    const end = [grid.length - 1, grid[0].length - 1];
    const paths = getPaths(grid, start, end);
    ns.tprint(`There are ${paths} unique paths from ${start} to ${end}`);
}

function getPaths(grid, start, end)
{
    const paths = [];
    const path = [];
    const visited = [];
    for (let i = 0; i < grid.length; i++)
    {
        visited[i] = [];
        for (let j = 0; j < grid[0].length; j++)
        {
            visited[i][j] = false;
        }
    }
    getPath(grid, start, end, path, paths, visited);
    return paths.length;
}

function getPath(grid, start, end, path, paths, visited)
{
    if (start[0] < 0 || start[0] >= grid.length || start[1] < 0 || start[1] >= grid[0].length)
        return;
    if (visited[start[0]][start[1]])
        return;
    if (grid[start[0]][start[1]] === 1)
        return;
    path.push(start);
    visited[start[0]][start[1]] = true;
    if (start[0] === end[0] && start[1] === end[1])
    {
        paths.push(path.slice());
    }
    else
    {
        getPath(grid, [start[0] + 1, start[1]], end, path, paths, visited);
        getPath(grid, [start[0], start[1] + 1], end, path, paths, visited);
    }
    path.pop();
    visited[start[0]][start[1]] = false;
}