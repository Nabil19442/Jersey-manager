import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Order, Expense, InventoryItem, User } from "../types";
import toast from "react-hot-toast";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDocFromServer
} from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { db, auth } from "../lib/firebase";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface DataContextType {
  orders: Order[];
  inventory: InventoryItem[];
  expenses: Expense[];
  loading: boolean;
  user: User | null;
  login: () => Promise<boolean>;
  logout: () => void;
  addItem: (collectionName: string, item: any) => Promise<void>;
  updateItem: (collectionName: string, id: string, item: any) => Promise<void>;
  deleteItem: (collectionName: string, id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Validate Connection to Firestore on boot as per guidelines
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          email: firebaseUser.email || "",
          id: firebaseUser.uid
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setInventory([]);
      setExpenses([]);
      return;
    }

    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Order));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orders");
    });

    const qInventory = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      setInventory(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as InventoryItem));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "inventory");
    });

    const qExpenses = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Expense));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "expenses");
    });

    return () => {
      unsubOrders();
      unsubInventory();
      unsubExpenses();
    };
  }, [user]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        toast.success("Welcome back!");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed", error);
      toast.error("Login failed. Please try again.");
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const refreshData = async () => {
    // onSnapshot handles data freshness
  };

  const addItem = async (collectionName: string, item: any) => {
    try {
      const dataToAdd = {
        ...item,
        createdAt: new Date().toISOString(),
        ownerId: auth.currentUser?.uid // Add ownerId for rules
      };
      await addDoc(collection(db, collectionName), dataToAdd);
      toast.success(`Registered in ${collectionName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionName);
    }
  };

  const updateItem = async (collectionName: string, id: string, item: any) => {
    try {
      const { id: _, ...dataToUpdate } = item;
      await updateDoc(doc(db, collectionName, id), {
        ...dataToUpdate,
        updatedAt: new Date().toISOString()
      });
      toast.success("Updated successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const deleteItem = async (collectionName: string, id: string) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success("Deleted successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  return (
    <DataContext.Provider
      value={{
        orders,
        inventory,
        expenses,
        loading,
        user,
        login,
        logout,
        addItem,
        updateItem,
        deleteItem,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
