import React, { useState } from "react";
import Hidden from "./Hidden";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LinkCopier from "./LinkCopier";

const Form = () => {
  const [enteredUrl, setEnteredUrl] = useState("");
  const [customName, setCustomName] = useState("");

  const clearInputs = () => {
    setEnteredUrl("");
    setCustomName("");
  };

  const formSubmitHandler = async (event: any) => {
    event.preventDefault();

    if (!enteredUrl) {
      toast("You have to pass a valid link!", {
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        type: "error",
      });
      return;
    }

    if (!customName) {
      const response = await toast.promise(
        fetch("/api/urls", {
          method: "POST",
          body: JSON.stringify({
            url: enteredUrl,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }).then(async (data) => {
          if (data.status === 201) {
            data.json().then((d) => {
              toast(<LinkCopier url={d.shortUrl} />, {
                type: "success",
                autoClose: 15000,
                style: { background: "rgb(229 231 235)" },
              });
            });
          }
          return data.status !== 201 && Promise.reject(await data.json());
        }),
        {
          pending: "Loading...",
          error: "Invalid link provided!",
        }
      );

      console.log(response);

      clearInputs();
      return;
    }

    const response = await fetch("/api/urls", {
      method: "POST",
      body: JSON.stringify({
        url: enteredUrl,
        customName,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => response.json());

    console.log(response);
    clearInputs();
  };

  const linkInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEnteredUrl(event.target.value);
  };

  const nameInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomName(event.target.value);
  };

  return (
    <form className="form" onSubmit={(event) => event.preventDefault()}>
      <div className="flex">
        <input
          className="input"
          type="text"
          placeholder="Link"
          value={enteredUrl}
          onInput={linkInputHandler}
        />

        <input
          type="submit"
          value="Dżajcuj"
          className="submit-button"
          onClick={formSubmitHandler}
        />
      </div>
      <Hidden>
        <input
          type="text"
          className="input"
          placeholder="Custom Name"
          value={customName}
          onInput={nameInputHandler}
        />
      </Hidden>
    </form>
  );
};

export default Form;
