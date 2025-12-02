import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  color: string;
}

interface EnvironmentContextType {
  environments: Environment[];
  activeEnvironment: Environment | null;
  setActiveEnvironment: (env: Environment | null) => void;
  addEnvironment: (env: Omit<Environment, 'id'>) => void;
  updateEnvironment: (id: string, env: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  getVariable: (key: string) => string | undefined;
  resolveVariables: (text: string) => string;
}

const defaultEnvironments: Environment[] = [
  {
    id: 'development',
    name: 'Development',
    color: '#10b981',
    variables: [
      { key: 'BASE_URL', value: 'http://localhost:8080', enabled: true },
      { key: 'API_KEY', value: 'dev-api-key', enabled: true },
    ],
  },
  {
    id: 'staging',
    name: 'Staging',
    color: '#f59e0b',
    variables: [
      { key: 'BASE_URL', value: 'https://staging-api.example.com', enabled: true },
      { key: 'API_KEY', value: 'staging-api-key', enabled: true },
    ],
  },
  {
    id: 'production',
    name: 'Production',
    color: '#ef4444',
    variables: [
      { key: 'BASE_URL', value: 'https://api.example.com', enabled: true },
      { key: 'API_KEY', value: 'prod-api-key', enabled: true },
    ],
  },
];

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

const STORAGE_KEY = 'api-tester-environments';
const ACTIVE_ENV_KEY = 'api-tester-active-env';

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environments, setEnvironments] = useState<Environment[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultEnvironments;
  });

  const [activeEnvironment, setActiveEnvironmentState] = useState<Environment | null>(() => {
    const storedId = localStorage.getItem(ACTIVE_ENV_KEY);
    if (storedId) {
      const stored = localStorage.getItem(STORAGE_KEY);
      const envs: Environment[] = stored ? JSON.parse(stored) : defaultEnvironments;
      return envs.find(e => e.id === storedId) || envs[0] || null;
    }
    return defaultEnvironments[0];
  });

  // Persist environments to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(environments));
  }, [environments]);

  // Persist active environment to localStorage
  useEffect(() => {
    if (activeEnvironment) {
      localStorage.setItem(ACTIVE_ENV_KEY, activeEnvironment.id);
    } else {
      localStorage.removeItem(ACTIVE_ENV_KEY);
    }
  }, [activeEnvironment]);

  const setActiveEnvironment = (env: Environment | null) => {
    setActiveEnvironmentState(env);
  };

  const addEnvironment = (env: Omit<Environment, 'id'>) => {
    const newEnv: Environment = {
      ...env,
      id: `env-${Date.now()}`,
    };
    setEnvironments(prev => [...prev, newEnv]);
  };

  const updateEnvironment = (id: string, updates: Partial<Environment>) => {
    setEnvironments(prev =>
      prev.map(env => (env.id === id ? { ...env, ...updates } : env))
    );
    // Update active environment if it's the one being updated
    if (activeEnvironment?.id === id) {
      setActiveEnvironmentState(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteEnvironment = (id: string) => {
    setEnvironments(prev => prev.filter(env => env.id !== id));
    if (activeEnvironment?.id === id) {
      setActiveEnvironmentState(null);
    }
  };

  const getVariable = (key: string): string | undefined => {
    if (!activeEnvironment) return undefined;
    const variable = activeEnvironment.variables.find(v => v.key === key && v.enabled);
    return variable?.value;
  };

  const resolveVariables = (text: string): string => {
    if (!activeEnvironment) return text;
    
    let resolved = text;
    activeEnvironment.variables
      .filter(v => v.enabled)
      .forEach(variable => {
        const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
        resolved = resolved.replace(regex, variable.value);
      });
    
    return resolved;
  };

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        activeEnvironment,
        setActiveEnvironment,
        addEnvironment,
        updateEnvironment,
        deleteEnvironment,
        getVariable,
        resolveVariables,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}

