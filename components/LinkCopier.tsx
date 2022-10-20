import { useCallback, useEffect } from "react";
import { AiOutlineCopy } from "react-icons/ai";
import copy from "../util/copy";

const LinkCopier = ({ url }: { url: string }) => {
  const copyHandler = useCallback(() => {
    copy(`${window.location.href}${url}`);
  }, [url]);

  let pop;

  useEffect(() => {
    setTimeout(() => {
      console.log("XD");
      pop = "-translate-y-0.5 transition";
    }, 2000);
  }, []);

  return (
    <div className="notification" onClick={copyHandler}>
      <div className="notification-link">{url}</div>
      <AiOutlineCopy
        size={25}
        className={`notification-icon ${pop}`}
        onClick={copyHandler}
      />
    </div>
  );
};

export default LinkCopier;
