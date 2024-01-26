import React, { createContext, useEffect, useState } from "react";

import axios from "axios";

type AkashaNotification = {
  color: string;
  message: string;
};

type NotificationsContextType = {
  notification: AkashaNotification;
  hideNotification: boolean;
  handleCloseNotification: (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => void;
};

const defaultValue = {
  notification: { color: "", message: " " },
  hideNotification: true,
  handleCloseNotification: () => {},
} as NotificationsContextType;

const NotificationsContext = createContext(defaultValue);

const NotificationsContextProvider: React.FC<{ children: any }> = ({
  children,
}) => {
  const [hideNotification, setHideNotification] = useState(true);
  const [notification, setNotification] = useState<AkashaNotification>(
    defaultValue.notification
  );

  const lsKey = "seenNotification";

  const getNotification = async (abortController: AbortController) => {
    const notificationURL = `/api/notifications/topbar`;
    const opts = { signal: abortController?.signal };

    const { data } = await axios.get(notificationURL, opts);
    if (!data) return;

    const lastMessage = localStorage.getItem(lsKey);
    const shouldHide = lastMessage === data.message;

    setHideNotification(shouldHide);
    setNotification(data);

    if (!shouldHide) return;
    localStorage.setItem(lsKey, data.message);
  };

  const handleClose = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    setHideNotification(true);
    if (notification?.message) {
      localStorage.setItem(lsKey, notification?.message);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    getNotification(abortController);
    return () => {
      abortController.abort();
    };
  }, []);

  const value = {
    hideNotification,
    notification,
    handleCloseNotification: handleClose,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export { NotificationsContext, NotificationsContextProvider };
