"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TreeNode {
  id: string;
  name: string;
  inBranchNumber: number;
  fullNumberPath: string;
  children?: TreeNode[];
  _count?: { products: number };
}

interface ProductTreeProps {
  items: TreeNode[];
}

export function ProductTree({ items }: ProductTreeProps) {
  return (
    <div className="border rounded-lg divide-y">
      {items.map((item) => (
        <TreeNodeItem key={item.id} node={item} level={0} />
      ))}
    </div>
  );
}

function TreeNodeItem({ node, level }: { node: TreeNode; level: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors ${
          level > 0 ? "border-t" : ""
        }`}
        style={{ paddingLeft: `${16 + level * 24}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-secondary transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          {!hasChildren && <span className="w-5 flex-shrink-0" />}
          <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex-shrink-0">
            {node.fullNumberPath}
          </span>
          <span className="font-medium truncate">{node.name}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {node._count && node._count.products > 0 && (
            <Link href={`/matrix?classifier=${node.fullNumberPath}`}>
              <Badge variant="secondary" className="text-xs">
                <Package className="h-3 w-3 mr-1" />
                {node._count.products}
              </Badge>
            </Link>
          )}
          <div className="flex gap-1">
            <Link href={`/matrix?classifier=${node.fullNumberPath}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Товары
              </Button>
            </Link>
            <Link href={`/library?classifier=${node.fullNumberPath}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Документы
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
