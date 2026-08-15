"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { comparePath } from "@/lib/utils";

interface FlatItem {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  productCount: number;
  docCount: number;
}

interface TreeNode extends FlatItem {
  children: TreeNode[];
  level: number;
}

interface ProductTreeProps {
  items: FlatItem[];
  expandAll?: boolean;
}

function buildTree(flat: FlatItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create nodes
  for (const item of flat) {
    map.set(item.id, { ...item, children: [], level: 0 });
  }

  // Second pass: build hierarchy
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Assign levels
  function assignLevel(nodes: TreeNode[], level: number) {
    for (const node of nodes) {
      node.level = level;
      // Сортируем детей числово по fullNumberPath
      node.children.sort((a, b) => comparePath(a.fullNumberPath, b.fullNumberPath));
      assignLevel(node.children, level + 1);
    }
  }
  assignLevel(roots, 0);

  // Сортируем корневые узлы
  roots.sort((a, b) => comparePath(a.fullNumberPath, b.fullNumberPath));

  return roots;
}

export function ProductTree({ items, expandAll }: ProductTreeProps) {
  const tree = useMemo(() => buildTree(items), [items]);

  return (
    <div className="border rounded-lg divide-y">
      {tree.map((node) => (
        <TreeNodeItem key={node.id} node={node} expandAll={expandAll} />
      ))}
    </div>
  );
}

function TreeNodeItem({ node, expandAll }: { node: TreeNode; expandAll?: boolean }) {
  const [expanded, setExpanded] = useState(expandAll || node.level < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors ${
          node.level > 0 ? "border-t" : ""
        }`}
        style={{ paddingLeft: `${16 + node.level * 24}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Indent for leaf nodes without children to align with siblings */}
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-secondary transition-colors"
              aria-label={expanded ? "Свернуть" : "Развернуть"}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}
          <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex-shrink-0">
            {node.fullNumberPath}
          </span>
          <span className="font-medium truncate">{node.name}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {node.productCount > 0 && (
            <Link href={`/matrix?classifier=${node.id}`}>
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                <Package className="h-3 w-3 mr-1" />
                {node.productCount}
              </Badge>
            </Link>
          )}
          <div className="flex gap-1">
            <Link href={`/matrix?classifier=${node.id}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Товары
              </Button>
            </Link>
            <Link href={`/library?classifier=${node.id}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Документы
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem key={child.id} node={child} expandAll={expandAll} />
          ))}
        </div>
      )}
    </div>
  );
}
