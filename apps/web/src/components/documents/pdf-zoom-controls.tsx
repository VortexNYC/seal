import {
	Maximize2Icon,
	MinusIcon,
	PlusIcon,
	RotateCcwIcon,
} from "lucide-react";
import { useControls } from "react-zoom-pan-pinch";
import { Button } from "../ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

/**
 * Zoom controls toolbar for PDF viewer
 * Integrates with react-zoom-pan-pinch for zoom/pan management
 */
export function PdfZoomControls() {
	const { zoomIn, zoomOut, resetTransform, zoomToElement, instance } =
		useControls();

	const currentZoom = instance.transformState.scale;
	const zoomPercentage = Math.round(currentZoom * 100);

	const handleZoomChange = (zoom: number) => {
		const element = instance.wrapperComponent;
		if (element) {
			zoomToElement(element, zoom, 0);
		}
	};

	return (
		<div className="flex items-center gap-2 p-2 bg-background border rounded-lg shadow-sm">
			<Button
				variant="ghost"
				size="icon"
				onClick={() => zoomOut()}
				disabled={currentZoom <= 0.5}
				title="Zoom out"
			>
				<MinusIcon className="h-4 w-4" />
			</Button>

			<Select
				value={currentZoom.toFixed(2)}
				onValueChange={(value) => handleZoomChange(Number.parseFloat(value))}
			>
				<SelectTrigger className="w-24">
					<SelectValue>{zoomPercentage}%</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{ZOOM_LEVELS.map((level) => (
						<SelectItem key={level} value={level.toFixed(2)}>
							{Math.round(level * 100)}%
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Button
				variant="ghost"
				size="icon"
				onClick={() => zoomIn()}
				disabled={currentZoom >= 2.0}
				title="Zoom in"
			>
				<PlusIcon className="h-4 w-4" />
			</Button>

			<div className="w-px h-6 bg-border" />

			<Button
				variant="ghost"
				size="sm"
				onClick={() => resetTransform()}
				title="Reset zoom"
			>
				<RotateCcwIcon className="h-4 w-4 mr-2" />
				Reset
			</Button>

			<Button
				variant="ghost"
				size="sm"
				onClick={() => handleZoomChange(1.0)}
				title="Fit to width"
			>
				<Maximize2Icon className="h-4 w-4 mr-2" />
				Fit
			</Button>
		</div>
	);
}
