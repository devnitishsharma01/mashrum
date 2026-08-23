import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client, { uploadImage } from "../api/client";
import { formatMoney, stockColor } from "../lib/format";

export default function Products() {
  const { loading: authLoading, error: authError, businessName, token, currency } =
    useAuthSession();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [variantForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const imageUrl = Form.useWatch("imageUrl", form);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (categoryId) params.set("categoryId", categoryId);
      const qs = params.toString();
      const [productData, categoryData] = await Promise.all([
        client.get(`/products${qs ? `?${qs}` : ""}`),
        client.get("/categories"),
      ]);
      setProducts(productData);
      setCategories(categoryData);
    } catch (err) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [token, q, categoryId]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      isVisible: true,
      initialStock: 0,
      basePrice: 0,
    });
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    form.setFieldsValue({
      name: product.name,
      description: product.description,
      categoryId: product.category?.id,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      isVisible: product.isVisible,
    });
    setModalOpen(true);
  }

  async function onSave(values) {
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        imageUrl: values.imageUrl || null,
        description: values.description || null,
      };
      if (editing) {
        await client.patch(`/products/${editing.id}`, payload);
        message.success("Product updated");
      } else {
        await client.post("/products", payload);
        message.success("Product created");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(product) {
    if (!token) return;
    Modal.confirm({
      title: `Delete "${product.name}"?`,
      content: "If this product has past orders, it will be archived instead.",
      okType: "danger",
      onOk: async () => {
        try {
          const result = await client.delete(`/products/${product.id}`);
          message.success(
            result.archived ? "Product archived" : "Product deleted",
          );
          await load();
        } catch (err) {
          message.error(err.message || "Delete failed");
        }
      },
    });
  }

  async function openDetail(productId) {
    if (!token) return;
    try {
      const data = await client.get(`/products/${productId}`);
      setDetail(data);
    } catch (err) {
      message.error(err.message || "Failed to load product");
    }
  }

  async function onAddVariant(values) {
    if (!token || !detail) return;
    setSaving(true);
    try {
      const result = await client.post(`/products/${detail.id}/variants`, {
        ...values,
        sku: values.sku || null,
      });
      setDetail(result.product);
      setVariantModalOpen(false);
      variantForm.resetFields();
      message.success("Variant added");
      await load();
    } catch (err) {
      message.error(err.message || "Failed to add variant");
    } finally {
      setSaving(false);
    }
  }

  const beforeUpload = async (file) => {
    if (!token) return Upload.LIST_IGNORE;
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("Only image files are allowed");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error("Image must be under 2MB");
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const result = await uploadImage(file);
      form.setFieldsValue({ imageUrl: result.url });
      message.success("Image uploaded");
    } catch (err) {
      message.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
    return Upload.LIST_IGNORE;
  };

  async function onDeleteVariant(variant) {
    if (!token || !detail) return;
    try {
      const product = await client.delete(
        `/products/${detail.id}/variants/${variant.id}`,
      );
      setDetail(product);
      message.success("Variant removed");
      await load();
    } catch (err) {
      message.error(err.message || "Failed to delete variant");
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Products">
        <Alert type="info" message="Loading..." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Products" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search products"
          allowClear
          onSearch={setQ}
          style={{ width: 240 }}
        />
        <Select
          allowClear
          placeholder="Category"
          style={{ width: 200 }}
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add product
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={products}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: "Product",
            dataIndex: "name",
            render: (name, row) => (
              <Space>
                {row.imageUrl ? (
                  <Image
                    src={row.imageUrl}
                    alt={name}
                    width={40}
                    height={40}
                    style={{ objectFit: "cover", borderRadius: 6 }}
                    preview={false}
                  />
                ) : null}
                <Button
                  type="link"
                  onClick={() => openDetail(row.id)}
                  style={{ padding: 0 }}
                >
                  {name}
                </Button>
              </Space>
            ),
          },
          {
            title: "Category",
            dataIndex: ["category", "name"],
            render: (v) => v || "—",
          },
          {
            title: "Price",
            dataIndex: "basePrice",
            render: (v) => formatMoney(v, currency),
          },
          {
            title: "Stock",
            dataIndex: "quantityOnHand",
            width: 90,
          },
          {
            title: "Stock status",
            dataIndex: "stockStatus",
            render: (status) => (
              <Tag color={stockColor(status)}>
                {status.replaceAll("_", " ")}
              </Tag>
            ),
          },
          {
            title: "Available",
            dataIndex: "isAvailable",
            width: 100,
            render: (v) =>
              v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
          },
          {
            title: "Visible",
            dataIndex: "isVisible",
            width: 90,
            render: (v) =>
              v ? <Tag color="blue">Shop</Tag> : <Tag>Hidden</Tag>,
          },
          {
            title: "Actions",
            key: "actions",
            width: 160,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button size="small" danger onClick={() => onDelete(row)}>
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Edit product" : "Add product"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Category" name="categoryId">
            <Select allowClear options={categoryOptions} />
          </Form.Item>
          <Form.Item
            label="Price"
            name="basePrice"
            rules={[{ required: true, message: "Price is required" }]}
          >
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
          {!editing ? (
            <>
              <Form.Item label="SKU (optional)" name="sku">
                <Input />
              </Form.Item>
              <Form.Item label="Initial stock" name="initialStock">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item label="Product image" name="imageUrl">
            <Input placeholder="https://... or upload below" />
          </Form.Item>
          <Space align="start" style={{ marginBottom: 16 }}>
            <Upload
              accept="image/png,image/jpeg,image/webp,image/gif"
              showUploadList={false}
              beforeUpload={beforeUpload}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                Upload image
              </Button>
            </Upload>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="Product"
                width={72}
                height={72}
                style={{ objectFit: "cover", borderRadius: 8 }}
              />
            ) : null}
          </Space>
          {editing ? (
            <Form.Item
              label="Available for ordering"
              name="isAvailable"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          ) : null}
          <Form.Item
            label="Visible in shop"
            name="isVisible"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detail?.name || "Product"}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={480}
        extra={
          <Button
            type="primary"
            onClick={() => {
              variantForm.resetFields();
              variantForm.setFieldsValue({
                initialStock: 0,
                price: detail?.basePrice,
              });
              setVariantModalOpen(true);
            }}
          >
            Add variant
          </Button>
        }
      >
        {detail ? (
          <>
            <Typography.Paragraph type="secondary">
              {detail.description || "No description"}
            </Typography.Paragraph>
            <Typography.Paragraph>
              Base price: {formatMoney(detail.basePrice, currency)}
              <br />
              Stock: {detail.quantityOnHand} (
              {detail.stockStatus.replaceAll("_", " ")})
            </Typography.Paragraph>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.variants}
              locale={{ emptyText: "No variants" }}
              columns={[
                { title: "Variant", dataIndex: "name" },
                {
                  title: "Price",
                  dataIndex: "price",
                  render: (v) => formatMoney(v, currency),
                },
                { title: "Stock", dataIndex: "quantityOnHand", width: 70 },
                {
                  title: "",
                  key: "actions",
                  width: 80,
                  render: (_, row) => (
                    <Button
                      size="small"
                      danger
                      onClick={() => onDeleteVariant(row)}
                    >
                      Delete
                    </Button>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </Drawer>

      <Modal
        title="Add variant"
        open={variantModalOpen}
        onCancel={() => setVariantModalOpen(false)}
        onOk={() => variantForm.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={variantForm} layout="vertical" onFinish={onAddVariant}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. 1kg / Large" />
          </Form.Item>
          <Form.Item label="SKU" name="sku">
            <Input />
          </Form.Item>
          <Form.Item
            label="Price"
            name="price"
            rules={[{ required: true, message: "Price is required" }]}
          >
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Initial stock" name="initialStock">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  );
}
