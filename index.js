require("dotenv").config();
const express = require("express");
const request = require("request-promise");
const lodash = require("lodash");
const uri = process.env.URL;
const sc = process.env.SECRET_KEY;
const app = express();
const port = process.env.PORT || 3000;

if (!uri || !sc) {
  console.error("Please set the 'URL' and 'SECRET_KEY' environment variables.");
  process.exit(1);
}
const cache = {};
app.get("/", (req, res) => {
  try {
    res.json({ message: "hello" });
  } catch (error) {
    console.error("An error occurred:", error.message);
    res.status(500).json({
      error: "An error occurred while processing the request.",
    });
  }
});
app.get("/api/blog-stats", async (req, res) => {
  try {
    const responseData = await fetchBlogData();
    const blogData = responseData.blogs;
    const result = await computeBlogStats(blogData);
    res.json(result);
  } catch (error) {
    console.error(
      "An error occurred while fetching and analyzing blog data:",
      error.message
    );
    res.status(500).json({
      error: "An error occurred while fetching and analyzing blog data.",
    });
  }
});

app.get("/api/blog-search", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res
        .status(400)
        .json({ error: "Query parameter 'query' is required." });
    }
    const cacheKey = `/api/blog-search?query=${query}`;
    if (cache[cacheKey]) {
      res.json(cache[cacheKey]);
    } else {
      // If not cached, fetch data and compute result
      const responseData = await fetchBlogData();
      const blogData = responseData.blogs;
      const result = await searchForBlogs(blogData, query);
      // Storing the result in the cache with the cache key
      cache[cacheKey] = result;
      res.json(result);
    }
  } catch (error) {
    console.error(
      "An error occurred while searching for blogs:",
      error.message
    );
    res.status(500).json({
      error: "An error occurred while searching for blogs.",
    });
  }
});

async function fetchBlogData() {
  try {
    const requestOptions = {
      uri: uri,
      headers: {
        "x-hasura-admin-secret": sc,
      },
      json: true,
    };

    const response = await request(requestOptions);
    return response;
  } catch (error) {
    console.error(
      "Error fetching data from the third-party API:",
      error.message
    );
    throw new Error(
      "Error fetching data from the third-party API: " + error.message
    );
  }
}

async function computeBlogStats(blogData) {
  const totalBlogs = blogData.length;
  const blogWithLongestTitle = lodash.maxBy(blogData, "title.length");
  const blogWithLongestTitleName = blogWithLongestTitle.title;
  const blogsWithPrivacy = lodash.filter(blogData, (blog) =>
    blog.title.toLowerCase().includes("privacy")
  );
  const blogTitlesWithPrivacy = blogsWithPrivacy.map((blog) => blog.title);
  const uniqueBlogTitles = lodash.uniqBy(blogData, "title");
  const uniqueBlogNames = uniqueBlogTitles.map((blog) => blog.title);

  return {
    totalBlogs,
    blogWithLongestTitle: blogWithLongestTitleName,
    numberOfBlogsWithPrivacy: blogsWithPrivacy.length,
    blogTitlesWithPrivacy,
    uniqueBlogTitles: uniqueBlogNames,
  };
}

async function searchForBlogs(blogData, query) {
  const matchingBlogs = lodash.filter(blogData, (blog) =>
    blog.title.toLowerCase().includes(query.toLowerCase())
  );
  const matchingBlogTitles = matchingBlogs.map((blog) => blog.title);

  return {
    query,
    matchingBlogCount: matchingBlogs.length,
    matchingBlogTitles,
  };
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "An unexpected error occurred on the server.",
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
