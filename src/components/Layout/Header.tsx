import React from "react";

const Header = () => {
	return (
		<header className="flex flex-col items-center pt-16 pb-3">
			<h1 className="text-5xl pb-7 font-bold text-gray-800">dzajco</h1>
			<h2 className="text-xl inline-block text-center text-gray-500">
				The best link shortener you were looking for.
			</h2>
		</header>
	);
};

export default React.memo(Header);
