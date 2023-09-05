type Props = {
	action: (id: string) => Promise<void>;
	id: string;
};

const HistoryItem = ({ action, id }: Props) => {
	return (
		<button
			formAction={() => {
				action(id);
			}}>
			HistoryItem
		</button>
	);
};

export default HistoryItem;
