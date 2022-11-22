import React from "react";

const Header = () => {
	return (
		<header className="header">
			<h1 className="h1">dzajco</h1>
			<h2 className="h2">The best link shortener you were looking for.</h2>
		</header>
	);
};

export default React.memo(Header);
