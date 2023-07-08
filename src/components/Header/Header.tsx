import React from "react";

const Header = () => {
	return (
		<header className="flex flex-col items-center pt-20 pb-3">
			<h1 className="text-5xl pb-7 font-bold">dzajco</h1>
			<h2 className="text-xl inline-block text-center">
				The best link shortener you were looking for.
			</h2>
		</header>
	);
};

export default React.memo(Header);
