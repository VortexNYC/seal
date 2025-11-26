import type { Id } from "@seal/backend/convex/_generated/dataModel";
import {
	CalendarIcon,
	CheckSquareIcon,
	PenToolIcon,
	TrashIcon,
	TypeIcon,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { FieldType } from "./field-toolbar";

interface FieldListItem {
	_id: Id<"signature_fields">;
	fieldType: FieldType;
	label: string;
	page: number;
	recipientId: Id<"document_recipients">;
	recipientName?: string;
	recipientEmail?: string;
	x: number;
	y: number;
}

interface Recipient {
	_id: Id<"document_recipients">;
	name?: string;
	email: string;
}

interface FieldListProps {
	fields: FieldListItem[];
	recipients: Recipient[];
	selectedFieldId: string | null;
	canEdit: boolean;
	onFieldSelect?: (fieldId: string) => void;
	onFieldDelete?: (fieldId: string) => void;
}

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
	signature: <PenToolIcon className="h-4 w-4" />,
	text: <TypeIcon className="h-4 w-4" />,
	date: <CalendarIcon className="h-4 w-4" />,
	checkbox: <CheckSquareIcon className="h-4 w-4" />,
	dropdown: <TypeIcon className="h-4 w-4" />,
	radio: <CheckSquareIcon className="h-4 w-4" />,
	attachment: <TypeIcon className="h-4 w-4" />,
};

const FIELD_COLORS: Record<FieldType, string> = {
	signature: "bg-blue-100 text-blue-700 border-blue-200",
	text: "bg-green-100 text-green-700 border-green-200",
	date: "bg-purple-100 text-purple-700 border-purple-200",
	checkbox: "bg-orange-100 text-orange-700 border-orange-200",
	dropdown: "bg-cyan-100 text-cyan-700 border-cyan-200",
	radio: "bg-pink-100 text-pink-700 border-pink-200",
	attachment: "bg-lime-100 text-lime-700 border-lime-200",
};

const FIELD_LABELS: Record<FieldType, string> = {
	signature: "Signature",
	text: "Text",
	date: "Date",
	checkbox: "Checkbox",
	dropdown: "Dropdown",
	radio: "Radio",
	attachment: "Attachment",
};

export function FieldList({
	fields,
	recipients,
	selectedFieldId,
	canEdit,
	onFieldSelect,
	onFieldDelete,
}: FieldListProps) {
	// Create a map of recipient IDs to recipient info for quick lookup
	const recipientMap = new Map(
		recipients.map((r) => [r._id, { name: r.name, email: r.email }]),
	);

	if (fields.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p className="text-sm">No fields added yet</p>
				<p className="text-xs mt-1">
					Drag fields from the toolbar onto the document
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{fields.map((field) => {
				const recipient = recipientMap.get(field.recipientId);
				const isSelected = selectedFieldId === field._id;

				return (
					<button
						key={field._id}
						type="button"
						onClick={() => onFieldSelect?.(field._id)}
						className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
							isSelected
								? "border-primary bg-primary/5"
								: "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
						}`}
					>
						<div className="flex items-start justify-between gap-2">
							<div className="flex items-start gap-2 flex-1 min-w-0">
								<div
									className={`mt-0.5 p-1.5 rounded-md border ${FIELD_COLORS[field.fieldType]}`}
								>
									{FIELD_ICONS[field.fieldType]}
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-medium">
											{FIELD_LABELS[field.fieldType]}
										</span>
										<Badge variant="outline" className="text-xs">
											Page {field.page}
										</Badge>
									</div>
									{recipient && (
										<p className="text-xs text-muted-foreground mt-1 truncate">
											{recipient.name || recipient.email}
										</p>
									)}
								</div>
							</div>
							{canEdit && (
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0"
									onClick={(e) => {
										e.stopPropagation();
										// First select the field, then trigger delete
										onFieldSelect?.(field._id);
										// Use setTimeout to ensure selection happens first
										setTimeout(() => {
											onFieldDelete?.(field._id);
										}, 0);
									}}
								>
									<TrashIcon className="h-4 w-4 text-destructive" />
								</Button>
							)}
						</div>
					</button>
				);
			})}
		</div>
	);
}
