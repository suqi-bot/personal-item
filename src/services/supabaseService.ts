// src/services/supabaseService.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 从环境变量获取 Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 检查环境变量是否已设置
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// 创建 Supabase 客户端实例
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// 认证服务
export const authService = {
  // 注册新用户
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  // 登录
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // 登出
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // 获取当前用户
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // 监听认证状态变化
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// 数据库服务
export const dbService = {
  // 通用查询方法
  async select(table: string, columns = '*', filters = {}) {
    let query = supabase.from(table).select(columns);
    
    // 应用过滤器
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data, error } = await query;
    return { data, error };
  },

  // 插入数据
  async insert(table: string, values: any | any[]) {
    const { data, error } = await supabase
      .from(table)
      .insert(values)
      .select();
    return { data, error };
  },

  // 更新数据
  async update(table: string, values: any, matchColumn: string, matchValue: any) {
    const { data, error } = await supabase
      .from(table)
      .update(values)
      .eq(matchColumn, matchValue)
      .select();
    return { data, error };
  },

  // 删除数据
  async delete(table: string, matchColumn: string, matchValue: any) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq(matchColumn, matchValue);
    return { data, error };
  },
};

// 存储服务
export const storageService = {
  // 上传文件
  async upload(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);
    return { data, error };
  },

  // 获取文件公共URL
  getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return data.publicUrl;
  },

  // 下载文件
  async download(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);
    return { data, error };
  },

  // 删除文件
  async remove(bucket: string, paths: string[]) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths);
    return { data, error };
  },
};

// 实时订阅服务
export const realtimeService = {
  // 订阅表变更
  subscribeToTable(
    table: string, 
    callback: (payload: any) => void,
    filter?: { column: string; value: any }
  ) {
    let subscription = supabase
      .channel(`table-changes-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*', // 监听所有事件: INSERT, UPDATE, DELETE
          schema: 'public',
          table: table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
        },
        callback
      )
      .subscribe();
    
    return subscription;
  },

  // 取消订阅
  unsubscribe(subscription: any) {
    supabase.removeChannel(subscription);
  },
};

// 边缘函数服务
export const functionsService = {
  // 调用边缘函数
  async invokeFunction(functionName: string, payload?: any) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });
    return { data, error };
  },
};

export default {
  supabase,
  authService,
  dbService,
  storageService,
  realtimeService,
  functionsService,
};
