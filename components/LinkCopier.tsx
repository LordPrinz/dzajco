import { useCallback } from "react";
import { AiOutlineCopy } from "react-icons/ai";
import copy from "../util/copy";

const LinkCopier = ({ url }: { url: string }) => {
  const copyHandler = useCallback(() => {
    copy(`${window.location.href}${url}`);
  }, [url]);

  return (
    <div className="notification" onClick={copyHandler}>
      <div className="notification-link">{url}</div>
      <AiOutlineCopy
        size={25}
        className="notification-icon"
        onClick={copyHandler}
      />
    </div>
  );
};

export default LinkCopier;
