<template>
  <div>
    <h1>Supabase Articles Example</h1>
    <div>
      <h2>Get All Articles</h2>
      <button @click="getArticles">Get Articles</button>
    </div>
    <div>
      <h2>Create New Article</h2>
      <input v-model="newArticle.title" placeholder="Title" />
      <textarea v-model="newArticle.content" placeholder="Content"></textarea>
      <button @click="createArticle">Create Article</button>
    </div>
    <div>
      <h2>Update Article</h2>
      <input v-model="updateArticleId" placeholder="Article ID" />
      <input v-model="updatedTitle" placeholder="New Title" />
      <textarea v-model="updatedContent" placeholder="New Content"></textarea>
      <button @click="updateArticle">Update Article</button>
    </div>
    <div>
      <h2>Delete Article</h2>
      <input v-model="deleteArticleId" placeholder="Article ID" />
      <button @click="deleteArticle">Delete Article</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://mkcqbexvybospanfcawz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rY3FiZXh2eWJvc3BhbmZjYXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzUzNzUsImV4cCI6MjA3MDExMTM3NX0.CMzer_I2a0QZT9kX-OCMx0kkcX21xHjzXDQJC-W5Py8')

// Reactive state
const newArticle = ref({
  title: '',
  content: ''
})
const updateArticleId = ref('')
const updatedTitle = ref('')
const updatedContent = ref('')
const deleteArticleId = ref('')

// Get all articles
async function getArticles() {
  let { data: articles, error } = await supabase
    .from('articles')
    .select()
  if (error) console.error('Error: ', error)
  else console.log('Articles: ', articles)
}

// Create new article
async function createArticle() {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      title: newArticle.value.title,
      content: newArticle.value.content,
      excerpt: 'ceshi',
      created_at: new Date(),
      updated_at: new Date(),
      published: true,
      read_time: 0,
      likes_count: 0
    })
  if (error) console.error('Error: ', error)
  else {
    console.log('Created Article: ', data)
    // Reset form
    newArticle.value.title = ''
    newArticle.value.content = ''
  }
}

// Update existing article
async function updateArticle() {
  const { data, error } = await supabase
    .from('articles')
    .update({
      title: updatedTitle.value,
      content: updatedContent.value
    })
    .eq('id', updateArticleId.value)
  if (error) console.error('Error: ', error)
  else {
    console.log('Updated Article: ', data)
    // Reset form
    updateArticleId.value = ''
    updatedTitle.value = ''
    updatedContent.value = ''
  }
}

// Delete article
async function deleteArticle() {
  const { data, error } = await supabase
    .from('articles')
    .delete()
    .eq('id', deleteArticleId.value)
  if (error) console.error('Error: ', error)
  else {
    console.log('Deleted Article: ', data)
    // Reset form
    deleteArticleId.value = ''
  }
}
</script>

<style scoped>
/* Add some basic styling */
div {
  margin-bottom: 20px;
}
input, textarea {
  margin: 5px 0;
  padding: 8px;
  width: 300px;
}
textarea {
  height: 100px;
}
button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #45a049;
}
</style>
