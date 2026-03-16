import useAppStore from "../../store/useAppStore"
import TreeItem from "./TreeItem"

export default function FileTree() {
    const tree = useAppStore((s) => s.tree)

    if (!tree) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-[10px] text-ghost">no tree data</p>
            </div>
        )
    }

    return (
        <div className="py-1">
            <TreeItem node={tree} depth={0} />
        </div>
    )
}
