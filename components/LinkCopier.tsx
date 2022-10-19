import { AiOutlineCopy } from "react-icons/ai";


const LinkCopier = ({url}: {url: string}) => {
  return <div className="notification">
    <div className="notification-link">{url}</div>
    <AiOutlineCopy className="notification-icon"/>
  </div>
}

export default LinkCopier;