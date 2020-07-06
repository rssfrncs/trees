import { startOfDay } from "date-fns";
import { Tree, TreeDaily } from "./store";

async function fetchTrees() {
  return fetch("https://public.offset.earth/trees").then((res) => res.json());
}

function groupByDay(trees: Tree[]): TreeDaily[] {
  const grouped: TreeDaily[] = [];
  let cumulativeTotal = 0;
  for (const tree of trees) {
    cumulativeTotal += tree.value;
    if (grouped.length) {
      const tail = grouped[grouped.length - 1];
      const treeCreatedStartOfDay = startOfDay(
        new Date(tree.createdAt)
      ).toISOString();
      if (tail.date === treeCreatedStartOfDay) {
        tail.total += tree.value;
        tail.cumulative = cumulativeTotal;
      } else {
        grouped.push({
          date: treeCreatedStartOfDay,
          total: tree.value,
          cumulative: cumulativeTotal,
        });
      }
    } else {
      // first iteration
      grouped.push({
        date: startOfDay(new Date(tree.createdAt)).toISOString(),
        total: tree.value,
        cumulative: cumulativeTotal,
      });
    }
  }
  return grouped;
}

function sortTree(trees: Tree[]): Tree[] {
  return trees.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

async function fetchAndGroupTrees() {
  const data = await fetchTrees();
  // @ts-expect-error worker context
  self.postMessage({
    trees: groupByDay(sortTree(data)),
  });
}

fetchAndGroupTrees();
